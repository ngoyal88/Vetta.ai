"""Interview start orchestration."""
import uuid
from typing import Any, Dict, Optional, Union

from fastapi import HTTPException
from firebase_admin import firestore

from firebase_config import db
from models.interview import DifficultyLevel, InterviewSession, InterviewType
from services.jd_fit.jd_fit_repository import get_snapshot_for_user
from services.profile_memory.profile_claims_repository import get_profile_memory_summary
from services.interview.contracts.session_events import SessionEvent, SessionEventType, SessionStateMachine
from services.interview.jd_context_service import clean_optional_text
from services.interview.modes.registry import get_mode_capabilities, is_startable_interview_type
from services.interview.modes.start_configs import (
    StartBlindRequest,
    StartInterviewRequest,
    StartPairProgrammingRequest,
    StartPressureRequest,
    StartResumeRequest,
    StartRoleTargetedRequest,
)
from services.interview.interview_service import InterviewService
from utils.logger import get_logger
from utils.redis_client import create_session

logger = get_logger("InterviewStartService")

# Re-export for routes/tests
__all__ = [
    "StartInterviewRequest",
    "StartRoleTargetedRequest",
    "StartResumeRequest",
    "StartPairProgrammingRequest",
    "extract_candidate_name",
    "load_active_resume",
    "start_interview_session",
]


def extract_candidate_name(resume_data: Optional[dict]) -> Optional[str]:
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


async def load_active_resume(uid: str) -> Dict[str, Any]:
    from services.vault.resume_snapshot_loader import load_active_resume_snapshot

    return await load_active_resume_snapshot(uid)


def _interview_type_from_request(
    request: Union[
        StartRoleTargetedRequest,
        StartResumeRequest,
        StartPairProgrammingRequest,
        StartPressureRequest,
        StartBlindRequest,
    ],
) -> InterviewType:
    return request.interview_type


async def start_interview_session(
    request: StartInterviewRequest,
    uid: str,
    *,
    interview_service: InterviewService,
    session_ttl: int,
) -> dict[str, Any]:
    session_id = str(uuid.uuid4())
    interview_type = _interview_type_from_request(request)  # type: ignore[arg-type]

    resume_data: Dict[str, Any] = request.resume_data or {}
    if not resume_data:
        resume_data = await load_active_resume(uid)

    target_company: Optional[str] = None
    target_role: Optional[str] = None
    job_description: Optional[str] = None
    interview_focus: Optional[str] = None
    pair_track: Optional[str] = None
    session_focus: Optional[str] = None
    snapshot_id: Optional[str] = None

    if isinstance(request, StartRoleTargetedRequest):
        cfg = request.config
        target_company = clean_optional_text(cfg.target_company, max_len=120)
        target_role = clean_optional_text(cfg.target_role, max_len=160)
        job_description = clean_optional_text(cfg.job_description, max_len=8000)
        interview_focus = cfg.interview_focus
        snapshot_id = (cfg.jd_fit_snapshot_id or "").strip() or None
    elif isinstance(request, StartPairProgrammingRequest):
        cfg = request.config
        pair_track = clean_optional_text(cfg.track, max_len=40) or "dsa"
        session_focus = clean_optional_text(cfg.session_focus, max_len=500)

    snapshot_data: Optional[Dict[str, Any]] = None
    if snapshot_id:
        snapshot_data = await get_snapshot_for_user(uid, snapshot_id)
        if not snapshot_data:
            logger.warning("jd_fit_snapshot_id not found for uid=%s id=%s", uid, snapshot_id)
        elif isinstance(request, StartRoleTargetedRequest):
            if not target_role and snapshot_data.get("target_role"):
                target_role = clean_optional_text(str(snapshot_data.get("target_role")), max_len=160)
            stored_jd = snapshot_data.get("job_description")
            if not job_description and isinstance(stored_jd, str) and stored_jd.strip():
                job_description = clean_optional_text(stored_jd, max_len=8000)
            stored_company = snapshot_data.get("target_company")
            if not target_company and isinstance(stored_company, str) and stored_company.strip():
                target_company = clean_optional_text(stored_company, max_len=120)

    if not is_startable_interview_type(interview_type):
        raise HTTPException(
            400,
            f"{interview_type.value} mode is currently disabled.",
        )

    caps = get_mode_capabilities(interview_type)
    if caps.requires_resume and not resume_data:
        raise HTTPException(400, "Upload an active resume in Vault before starting this interview mode.")

    mode_config = request.config
    if isinstance(request, StartRoleTargetedRequest) and snapshot_data:
        hydrated = request.config.model_copy(
            update={
                "target_role": target_role or request.config.target_role,
                "target_company": target_company or request.config.target_company,
                "job_description": job_description or request.config.job_description,
            }
        )
        mode_config = hydrated

    start_payload = await interview_service.prepare_mode_start(
        interview_type=interview_type,
        difficulty=request.difficulty,
        resume_data=resume_data,
        years_experience=request.years_experience,
        config=mode_config,
    )
    jd_fit_context = start_payload["jd_fit_context"]
    if snapshot_data and isinstance(snapshot_data.get("jd_fit_context"), dict):
        jd_fit_context = snapshot_data["jd_fit_context"]
    resume_probe_context = start_payload["resume_probe_context"]
    target_context = start_payload["target_context"] or {}
    profile_memory_summary = await get_profile_memory_summary(uid)
    if profile_memory_summary.get("accepted_count"):
        target_context["profile_memory_summary"] = profile_memory_summary
    seeded_questions: list[Dict[str, Any]] = start_payload["seeded_questions"]

    if isinstance(request, StartRoleTargetedRequest):
        target_company = target_context.get("target_company") or target_company
        target_role = target_context.get("target_role") or target_role
        job_description = target_context.get("job_description") or job_description
        interview_focus = target_context.get("interview_focus") or interview_focus

    if isinstance(request, StartPairProgrammingRequest):
        pair_track = target_context.get("track") or pair_track or "dsa"
        session_focus = target_context.get("session_focus") or session_focus

    if not seeded_questions:
        first_question = await interview_service.generate_first_question(
            interview_type,
            request.difficulty,
            resume_data,
            target_role if interview_type == InterviewType.ROLE_TARGETED else None,
            request.years_experience,
            target_context=target_context,
        )
        seeded_questions = [first_question]
    first_question = seeded_questions[0]

    candidate_name = request.candidate_name or extract_candidate_name(resume_data) or uid

    session = InterviewSession(
        session_id=session_id,
        user_id=uid,
        candidate_name=candidate_name,
        years_experience=request.years_experience,
        interview_type=interview_type,
        custom_role=None,
        target_company=target_company,
        target_role=target_role,
        job_description=job_description,
        interview_focus=interview_focus if interview_type == InterviewType.ROLE_TARGETED else None,
        track=pair_track if interview_type == InterviewType.PAIR_PROGRAMMING else None,
        session_focus=session_focus if interview_type == InterviewType.PAIR_PROGRAMMING else None,
        jd_fit_context=jd_fit_context,
        resume_probe_context=resume_probe_context,
        difficulty=request.difficulty,
        questions=seeded_questions,
        resume_data=resume_data or {},
        last_event_id=f"{session_id}:start",
    )
    session.status = SessionStateMachine.transition(
        session.status,
        SessionEvent(type=SessionEventType.START),
    ).value

    await create_session(
        f"interview:{session_id}",
        session.model_dump(mode="json"),
        expire_seconds=session_ttl,
    )

    try:
        db.collection("interviews").document(session_id).set(
            {
                "session_id": session_id,
                "user_id": uid,
                "candidate_name": candidate_name,
                "years_experience": request.years_experience,
                "interview_type": interview_type.value,
                "difficulty": request.difficulty.value,
                "custom_role": None,
                "target_company": target_company,
                "target_role": target_role,
                "job_description": job_description,
                "interview_focus": interview_focus if interview_type == InterviewType.ROLE_TARGETED else None,
                "track": pair_track if interview_type == InterviewType.PAIR_PROGRAMMING else None,
                "session_focus": session_focus if interview_type == InterviewType.PAIR_PROGRAMMING else None,
                "jd_fit_context": jd_fit_context,
                "resume_probe_context": resume_probe_context,
                "questions": seeded_questions,
                "current_question_index": 0,
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
            "interview_type": str(interview_type),
        },
    )

    return {
        "message": "Interview session started",
        "session_id": session_id,
        "question": first_question,
        "interview_type": interview_type,
        "difficulty": request.difficulty,
    }
