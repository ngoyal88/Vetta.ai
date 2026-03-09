from fastapi import Depends, HTTPException
from firebase_admin import auth as firebase_auth

from firebase_config import db
from utils.auth import verify_firebase_token
from utils.rate_limit import check_rate_limit
from utils.redis_client import redis, get_session, delete_session
from utils.logger import get_logger

from . import router

logger = get_logger("InterviewAccountRoutes")


@router.delete("/account/purge")
async def purge_account_data(
    uid: str = Depends(verify_firebase_token),
):
    """Delete all interview data for the authenticated user and remove their auth record."""
    try:
        await check_rate_limit(uid, "account_purge", limit=3, window_seconds=3600)

        # Delete interviews in Firestore
        try:
            docs = db.collection("interviews").where("user_id", "==", uid).stream()
            for doc in docs:
                doc.reference.delete()
        except Exception as e:
            logger.warning(f"Failed deleting Firestore interviews for {uid}: {e}")

        # Delete user profile doc if present
        try:
            prof_ref = db.collection("users").document(uid)
            if prof_ref.get().exists:
                prof_ref.delete()
        except Exception as e:
            logger.warning(f"Failed deleting user profile for {uid}: {e}")

        # Cleanup Redis sessions for this user
        try:
            async for key in redis.scan_iter("interview:*"):
                try:
                    data = await get_session(key)
                    if data and data.get("user_id") == uid:
                        await delete_session(key)
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Failed cleaning Redis for {uid}: {e}")

        # Delete Firebase auth user (best-effort)
        try:
            firebase_auth.delete_user(uid)
        except Exception as e:
            logger.warning(f"Failed deleting auth user {uid}: {e}")

        return {"message": "Account and interview data purged"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error purging account data: {e}", exc_info=True)
        raise HTTPException(500, "Failed to purge account")

