from fastapi import Depends, HTTPException

from services.interview.interview_complete_service import complete_interview_session
from utils.auth import verify_firebase_token
from utils.http_errors import raise_internal_error
from utils.rate_limit import check_rate_limit
from . import SESSION_TTL, interview_service, logger, router


@router.post("/complete")
async def complete_interview(
    session_id: str,
    uid: str = Depends(verify_firebase_token),
):
    """Complete interview and generate final feedback."""
    try:
        await check_rate_limit(uid, "complete", limit=20, window_seconds=60)
        return await complete_interview_session(
            session_id,
            uid,
            interview_service=interview_service,
            session_ttl=SESSION_TTL,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_error(logger, e, message="Failed to complete interview")
