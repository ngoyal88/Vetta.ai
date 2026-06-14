from fastapi import Depends, HTTPException

from models.account import PurgeAccountRequest
from services.interview.account_purge_service import purge_user_account
from utils.auth import verify_recent_firebase_token
from utils.rate_limit import check_rate_limit
from utils.logger import get_logger

from . import router

logger = get_logger("InterviewAccountRoutes")


@router.delete("/account/purge")
async def purge_account_data(
    body: PurgeAccountRequest,
    uid: str = Depends(verify_recent_firebase_token),
):
    """Delete all interview data for the authenticated user and remove their auth record."""
    if body.confirmation != "DELETE":
        raise HTTPException(403, "Confirmation required")

    try:
        await check_rate_limit(uid, "account_purge", limit=3, window_seconds=3600)
        return await purge_user_account(uid)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error purging account data: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to purge account")
