from fastapi import Depends, HTTPException

from services.interview.interview_history_service import (
    delete_interview_history,
    get_redis_session_details,
    list_interview_history,
)
from utils.auth import verify_firebase_token
from utils.http_errors import raise_internal_error
from utils.logger import get_logger
from utils.rate_limit import check_rate_limit

from . import router

logger = get_logger("InterviewHistoryRoutes")


@router.get("/history")
async def get_interview_history(
    limit: int = 20,
    uid: str = Depends(verify_firebase_token),
):
    """Return recent interviews for the authenticated user from Firestore."""
    try:
        await check_rate_limit(uid, "history", limit=60, window_seconds=60)
        return list_interview_history(uid, limit=limit)
    except Exception as e:
        logger.error("Error fetching history: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to fetch interview history")


@router.get("/session/{session_id}")
async def get_session_details(
    session_id: str,
    uid: str = Depends(verify_firebase_token),
):
    """Return complete session details from Redis."""
    try:
        return await get_redis_session_details(session_id, uid)
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_error(logger, e, message="Failed to fetch session details")


@router.delete("/history/{session_id}")
async def delete_interview_history_route(
    session_id: str,
    uid: str = Depends(verify_firebase_token),
):
    """Delete an interview history entry for the authenticated user."""
    try:
        await check_rate_limit(uid, "delete", limit=20, window_seconds=60)
        return await delete_interview_history(session_id, uid)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting interview history: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to delete interview")
