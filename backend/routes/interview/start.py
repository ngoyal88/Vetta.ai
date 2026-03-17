import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from firebase_admin import firestore
from pydantic import BaseModel, Field

from firebase_config import db
from models.interview import DifficultyLevel, InterviewSession, InterviewType
from utils.auth import verify_firebase_token
from utils.rate_limit import check_rate_limit
from utils.redis_client import create_session

from . import SESSION_TTL, interview_service, logger, router


class StartInterviewRequest(BaseModel):
    user_id: Optional[str] = None
    candidate_name: Optional[str] = None
    interview_type: InterviewType
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    custom_role: Optional[str] = None
    resume_data: Optional[dict] = None
    years_experience: Optional[int] = Field(None, ge=0, le=50)


@router.post("/start")
async def start_interview(
    request: StartInterviewRequest,
    uid: str = Depends(verify_firebase_token),
):
    """Start a new interview session."""
    try:
        await check_rate_limit(uid, "start", limit=10, window_seconds=60)

        if request.interview_type == InterviewType.CUSTOM and not request.custom_role:
            raise HTTPException(400, "custom_role required for custom interviews")

        session_id = str(uuid.uuid4())

        resume_data: Dict[str, Any] = request.resume_data or {}
        if not resume_data:
            try:
                doc = (
                    db.collection("users")
                    .document(uid)
                    .collection("profiles")
                    .document("resume_parsed")
                    .get()
                )
                if doc.exists:
                    payload = doc.to_dict() or {}
                    profile = payload.get("profile")
                    if isinstance(profile, dict):
                        resume_data = profile
            except Exception as e:
                logger.warning("Failed to load parsed resume for %s: %s", uid, e)

        first_question = await interview_service.generate_first_question(
            request.interview_type,
            request.difficulty,
            resume_data,
            request.custom_role,
            request.years_experience,
        )

        candidate_name = (
            request.candidate_name
            or ((resume_data or {}).get("name") if isinstance(resume_data, dict) else None)
            or request.user_id
        )

        session = InterviewSession(
            session_id=session_id,
            user_id=uid,
            candidate_name=candidate_name,
            years_experience=request.years_experience,
            interview_type=request.interview_type,
            custom_role=request.custom_role,
            difficulty=request.difficulty,
            questions=[first_question],
            resume_data=resume_data or {},
        )

        await create_session(f"interview:{session_id}", session.dict(), expire_seconds=SESSION_TTL)

        try:
            db.collection("interviews").document(session_id).set(
                {
                    "session_id": session_id,
                    "user_id": uid,
                    "candidate_name": candidate_name,
                    "years_experience": request.years_experience,
                    "interview_type": request.interview_type.value,
                    "difficulty": request.difficulty.value,
                    "custom_role": request.custom_role,
                    "status": "active",
                    "started_at": firestore.SERVER_TIMESTAMP,
                    "created_at": firestore.SERVER_TIMESTAMP,
                    "last_updated": firestore.SERVER_TIMESTAMP,
                    "questions_answered": 0,
                    "code_problems_attempted": 0,
                }
            )
        except Exception as e:
            logger.warning("Failed to persist interview start to Firestore: %s", e)

        logger.info(
            "interview_started",
            extra={
                "session_id": session_id,
                "user_id": uid,
                "interview_type": str(request.interview_type),
            },
        )

        return {
            "message": "Interview session started",
            "session_id": session_id,
            "question": first_question,
            "interview_type": request.interview_type,
            "difficulty": request.difficulty,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error starting interview: %s", e, exc_info=True)
        raise HTTPException(500, str(e))
