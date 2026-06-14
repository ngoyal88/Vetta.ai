"""Interview completion orchestration."""
import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi.encoders import jsonable_encoder
from firebase_admin import firestore

from firebase_config import db
from models.interview import InterviewSession
from services.interview.contracts.session_events import SessionEvent, SessionEventType
from services.interview.interview_service import InterviewService
from services.interview.contracts.session_events import SessionStateMachine
from services.interview.transcript_service import attach_transcript_to_session
from utils.feedback_parser import parse_scores_from_feedback
from utils.logger import get_logger
from utils.redis_client import get_session, update_session
from utils.session_access import require_session_owner

logger = get_logger("InterviewCompleteService")


async def complete_interview_session(
    session_id: str,
    uid: str,
    *,
    interview_service: InterviewService,
    session_ttl: int,
) -> dict[str, Any]:
    session_data = await get_session(f"interview:{session_id}")
    require_session_owner(session_data, uid)

    attach_transcript_to_session(session_data)
    session = InterviewSession(**session_data)
    duration = (datetime.now(timezone.utc) - session.started_at).total_seconds() / 60

    feedback_data = {
        "interview_type": session.interview_type.value,
        "custom_role": session.custom_role,
        "target_company": session.target_company,
        "target_role": session.target_role,
        "job_description": session.job_description,
        "interview_focus": session.interview_focus,
        "jd_fit_context": session.jd_fit_context,
        "duration": int(duration),
        "responses": session.responses,
        "code_submissions": [s.dict() for s in session.code_submissions],
        "live_transcription": session_data.get("live_transcription", []),
        "session_conductor": session_data.get("session_conductor"),
    }
    final_feedback = await interview_service.generate_final_feedback(feedback_data)
    replay_highlights = await interview_service.generate_replay_highlights(feedback_data)

    session.status = SessionStateMachine.transition(
        session.status,
        SessionEvent(type=SessionEventType.COMPLETE),
    ).value
    session.last_event_id = f"{session_id}:complete"
    session.completion_reason = session.completion_reason or "complete"
    session.completed_at = datetime.now(timezone.utc)
    session.live_transcription = session_data.get("live_transcription", [])
    session_dict = session.dict()
    await update_session(f"interview:{session_id}", session_dict, expire_seconds=session_ttl)

    try:
        scores = parse_scores_from_feedback(final_feedback.get("feedback"))
        payload = jsonable_encoder(
            {
                "session_id": session_id,
                "user_id": session.user_id,
                "candidate_name": session.candidate_name,
                "interview_type": session.interview_type.value,
                "difficulty": session.difficulty.value,
                "custom_role": session.custom_role,
                "target_company": session.target_company,
                "target_role": session.target_role,
                "job_description": session.job_description,
                "interview_focus": session.interview_focus,
                "jd_fit_context": session.jd_fit_context,
                "status": "completed",
                "duration_minutes": int(duration),
                "questions_answered": len(session.responses),
                "code_problems_attempted": len(session.code_submissions),
                "responses": session.responses,
                "questions": session.questions,
                "code_submissions": [s.dict() for s in session.code_submissions],
                "live_transcription": session_data.get("live_transcription", []),
                "final_feedback": final_feedback,
                "replay_highlights": replay_highlights,
                "scores": scores if scores else None,
                "pass": scores.get("overall", 0) >= 6,
            }
        )
        payload.setdefault("started_at", session.started_at)
        payload.setdefault("created_at", session.started_at)
        payload["last_updated"] = firestore.SERVER_TIMESTAMP
        payload["completed_at"] = firestore.SERVER_TIMESTAMP
        if not payload.get("scores"):
            payload.pop("scores", None)

        db.collection("interviews").document(session_id).set(payload, merge=True)
    except Exception as e:
        logger.warning("Failed to persist interview completion to Firestore: %s", e)

    return {
        "message": "Interview completed",
        "feedback": final_feedback,
        "duration_minutes": int(duration),
        "questions_answered": len(session.responses),
        "code_problems_attempted": len(session.code_submissions),
    }
