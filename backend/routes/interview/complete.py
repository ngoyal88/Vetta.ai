from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from firebase_admin import firestore

from models.interview import InterviewSession
from services.interview import InterviewService
from utils.auth import verify_firebase_token
from utils.feedback_parser import parse_scores_from_feedback
from utils.rate_limit import check_rate_limit
from utils.redis_client import get_session, update_session
from firebase_config import db

from . import router, logger, interview_service, SESSION_TTL


@router.post("/complete")
async def complete_interview(
    session_id: str,
    uid: str = Depends(verify_firebase_token),
):
    """Complete interview and generate final feedback."""
    try:
        await check_rate_limit(uid, "complete", limit=20, window_seconds=60)

        session_data = await get_session(f"interview:{session_id}")
        if not session_data:
            raise HTTPException(404, "Session not found")

        if session_data.get("user_id") and session_data.get("user_id") != uid:
            raise HTTPException(403, "Not authorized for this session")

        session = InterviewSession(**session_data)

        # Calculate duration
        duration = (datetime.now(timezone.utc) - session.started_at).total_seconds() / 60

        # Generate final feedback
        feedback_data = {
            "interview_type": session.interview_type.value,
            "custom_role": session.custom_role,
            "duration": int(duration),
            "responses": session.responses,
            "code_submissions": [s.dict() for s in session.code_submissions],
        }

        # Always generate final feedback; session data does not persist it (InterviewSession model has no final_feedback field)
        final_feedback = await interview_service.generate_final_feedback(feedback_data)

        # Update session
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)

        await update_session(
            f"interview:{session_id}",
            session.dict(),
            expire_seconds=SESSION_TTL,
        )

        # Firestore update
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
                    "status": "completed",
                    "duration_minutes": int(duration),
                    "questions_answered": len(session.responses),
                    "code_problems_attempted": len(session.code_submissions),
                    "responses": session.responses,
                    "questions": session.questions,
                    "code_submissions": [s.dict() for s in session.code_submissions],
                    "live_transcription": session.live_transcription,
                    "final_feedback": final_feedback,
                    "scores": scores if scores else None,
                    "pass": scores.get("overall", 0) >= 6,
                }
            )

            # Ensure start timestamps exist if initial write failed
            payload.setdefault("started_at", session.started_at)
            payload.setdefault("created_at", session.started_at)
            payload["last_updated"] = firestore.SERVER_TIMESTAMP
            # Replace timestamp fields after encoding to preserve Firestore sentinel values
            payload["completed_at"] = firestore.SERVER_TIMESTAMP
            if "scores" in payload and not payload["scores"]:
                payload.pop("scores", None)

            db.collection("interviews").document(session_id).set(payload, merge=True)
        except Exception as e:
            logger.warning(f"Failed to persist interview completion to Firestore: {e}")

        return {
            "message": "Interview completed",
            "feedback": final_feedback,
            "duration_minutes": int(duration),
            "questions_answered": len(session.responses),
            "code_problems_attempted": len(session.code_submissions),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "interview_complete_error",
            extra={"session_id": session_id, "error": str(e)},
            exc_info=True,
        )
        raise HTTPException(500, str(e))

