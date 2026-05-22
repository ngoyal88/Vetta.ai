import uuid
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
from services.vault.vault_service import get_vault_entry, get_vault_meta, get_version_by_id
from services.interview.jd_context_service import INTERVIEW_FOCUS_VALUES, clean_optional_text

from . import SESSION_TTL, interview_service, logger, router


class StartInterviewRequest(BaseModel):
    user_id: Optional[str] = None
    candidate_name: Optional[str] = None
    interview_type: InterviewType
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    custom_role: Optional[str] = None
    resume_data: Optional[dict] = None
    years_experience: Optional[int] = Field(None, ge=0, le=50)
    target_company: Optional[str] = None
    target_role: Optional[str] = None
    job_description: Optional[str] = None
    interview_focus: Optional[str] = "mixed"


def _extract_candidate_name(resume_data: Optional[dict]) -> Optional[str]:
    if not isinstance(resume_data, dict):
        return None
    name = resume_data.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    if isinstance(name, dict):
        raw = name.get("raw")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


async def _load_active_resume(uid: str) -> Dict[str, Any]:
    try:
        meta = await get_vault_meta(uid)
        active_id = meta.get("active_resume_id")
        if not active_id:
            return {}
        entry = await get_vault_entry(uid, active_id)
        if not entry:
            return {}
        version_id = entry.get("current_version_id")
        if not version_id:
            return {}
        version = await get_version_by_id(uid, version_id)
        if not version:
            return {}
        profile = version.get("profile_snapshot")
        return profile if isinstance(profile, dict) else {}
    except Exception as e:
        logger.warning("Failed to load vault resume for %s: %s", uid, e)
        return {}


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
            resume_data = await _load_active_resume(uid)

        target_company = clean_optional_text(request.target_company, max_len=120)
        target_role = clean_optional_text(request.target_role or request.custom_role, max_len=160)
        job_description = clean_optional_text(request.job_description, max_len=8000)
        interview_focus = (
            clean_optional_text(request.interview_focus or "mixed", max_len=40) or "mixed"
        ).lower().replace(" ", "_")

        if request.interview_type == InterviewType.ROLE_TARGETED:
            if not target_role:
                raise HTTPException(400, "target_role is required for role-targeted interviews")
            if interview_focus not in INTERVIEW_FOCUS_VALUES:
                raise HTTPException(400, "interview_focus must be one of: mixed, technical, behavioral, system_design, dsa")

        jd_fit_context: Dict[str, Any] = {}
        target_context: Optional[Dict[str, Any]] = None
        if request.interview_type == InterviewType.ROLE_TARGETED:
            jd_fit_context = await interview_service.build_jd_fit_context(
                target_company=target_company,
                target_role=target_role or "",
                job_description=job_description or "",
                interview_focus=interview_focus,
                resume_data=resume_data,
                years_experience=request.years_experience,
            )
            target_context = {
                "target_company": target_company,
                "target_role": target_role,
                "job_description": job_description,
                "interview_focus": interview_focus,
                "jd_fit_context": jd_fit_context,
            }

        first_question = await interview_service.generate_first_question(
            request.interview_type,
            request.difficulty,
            resume_data,
            target_role if request.interview_type == InterviewType.ROLE_TARGETED else request.custom_role,
            request.years_experience,
            target_context=target_context,
        )

        candidate_name = request.candidate_name or _extract_candidate_name(resume_data) or request.user_id or uid

        session = InterviewSession(
            session_id=session_id,
            user_id=uid,
            candidate_name=candidate_name,
            years_experience=request.years_experience,
            interview_type=request.interview_type,
            custom_role=target_role if request.interview_type == InterviewType.ROLE_TARGETED else request.custom_role,
            target_company=target_company,
            target_role=target_role,
            job_description=job_description,
            interview_focus=interview_focus if request.interview_type == InterviewType.ROLE_TARGETED else None,
            jd_fit_context=jd_fit_context,
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
                    "custom_role": target_role if request.interview_type == InterviewType.ROLE_TARGETED else request.custom_role,
                    "target_company": target_company,
                    "target_role": target_role,
                    "job_description": job_description,
                    "interview_focus": interview_focus if request.interview_type == InterviewType.ROLE_TARGETED else None,
                    "jd_fit_context": jd_fit_context,
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
