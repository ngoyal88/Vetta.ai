from fastapi import Depends, HTTPException

from services.interview.interview_start_service import (
    StartInterviewRequest,
    start_interview_session,
)
from utils.auth import verify_firebase_token
from utils.http_errors import raise_internal_error
from utils.rate_limit import check_rate_limit

from . import SESSION_TTL, interview_service, logger, router


@router.post("/start")
async def start_interview(
    request: StartInterviewRequest,
    uid: str = Depends(verify_firebase_token),
):
    """Start a new interview session."""
    try:
        await check_rate_limit(uid, "start", limit=10, window_seconds=60)
        return await start_interview_session(
            request,
            uid,
            interview_service=interview_service,
            session_ttl=SESSION_TTL,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_error(logger, e, message="Failed to start interview")
