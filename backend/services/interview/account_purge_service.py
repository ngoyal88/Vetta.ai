"""Account purge: Firestore interviews, profile, Redis sessions, Firebase Auth."""
from firebase_admin import auth as firebase_auth

from firebase_config import db
from utils.logger import get_logger
from utils.redis_client import delete_session, get_session, redis

logger = get_logger("AccountPurgeService")


async def purge_user_account(uid: str) -> dict[str, str]:
    try:
        docs = db.collection("interviews").where("user_id", "==", uid).stream()
        for doc in docs:
            doc.reference.delete()
    except Exception as e:
        logger.warning("Failed deleting Firestore interviews for %s: %s", uid, e)

    try:
        prof_ref = db.collection("users").document(uid)
        if prof_ref.get().exists:
            prof_ref.delete()
    except Exception as e:
        logger.warning("Failed deleting user profile for %s: %s", uid, e)

    try:
        async for key in redis.scan_iter("interview:*"):
            try:
                data = await get_session(key)
                if data and data.get("user_id") == uid:
                    await delete_session(key)
            except Exception:
                continue
    except Exception as e:
        logger.warning("Failed cleaning Redis for %s: %s", uid, e)

    try:
        firebase_auth.delete_user(uid)
    except Exception as e:
        logger.warning("Failed deleting auth user %s: %s", uid, e)

    return {"message": "Account and interview data purged"}
