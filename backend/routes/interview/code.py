from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from services.interview.code_submission_service import submit_code
from utils.auth import verify_firebase_token
from utils.http_errors import raise_internal_error
from utils.rate_limit import check_rate_limit
from utils.redis_client import get_session
from utils.session_access import require_session_owner

from . import SESSION_TTL, code_service, logger, router


class SubmitCodeRequest(BaseModel):
    session_id: str
    question_id: str
    language: str
    code: str = Field(..., max_length=50_000)


@router.post("/submit-code")
async def submit_code_route(
    request: SubmitCodeRequest,
    uid: str = Depends(verify_firebase_token),
):
    """Execute code against test cases (DSA interviews)."""
    try:
        await check_rate_limit(uid, "submit_code", limit=30, window_seconds=60)

        session_data = await get_session(f"interview:{request.session_id}")
        require_session_owner(session_data, uid)

        from services.interview.modes.registry import require_coding_session

        require_coding_session(session_data)

        return await submit_code(
            session_id=request.session_id,
            question_id=request.question_id,
            language=request.language,
            code=request.code,
            uid=uid,
            code_service=code_service,
            session_ttl=SESSION_TTL,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_error(logger, e, message="Failed to execute code")
