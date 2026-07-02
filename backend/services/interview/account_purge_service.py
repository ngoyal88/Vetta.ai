"""Account purge: Firestore interviews, profile, Redis sessions, Firebase Auth."""
import asyncio

from firebase_admin import auth as firebase_auth

from firebase_config import db
from utils.logger import get_logger
from utils.redis_client import delete_session, get_redis, get_session

logger = get_logger("AccountPurgeService")

_USER_SUBCOLLECTIONS = (
    "profile_claims",
    "profile_meta",
    "candidate_profile_memory",
    "pipeline_runs",
    "candidate_enrichments",
    "vault",
    "vault_meta",
    "readiness_snapshots",
    "jd_fit_snapshots",
)


def _delete_subcollection(uid: str, name: str) -> None:
    coll = db.collection("users").document(uid).collection(name)
    while True:
        docs = list(coll.limit(400).stream())
        if not docs:
            break
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()


def _purge_firestore(uid: str) -> None:
    try:
        for doc in db.collection("interviews").where("user_id", "==", uid).stream():
            doc.reference.delete()
    except Exception as e:
        logger.warning("Failed deleting Firestore interviews for %s: %s", uid, e)

    try:
        for subcollection in _USER_SUBCOLLECTIONS:
            _delete_subcollection(uid, subcollection)
    except Exception as e:
        logger.warning("Failed deleting user subcollections for %s: %s", uid, e)

    try:
        prof_ref = db.collection("users").document(uid)
        if prof_ref.get().exists:
            prof_ref.delete()
    except Exception as e:
        logger.warning("Failed deleting user profile for %s: %s", uid, e)


async def purge_user_account(uid: str) -> dict[str, str]:
    await asyncio.to_thread(_purge_firestore, uid)

    try:
        client = await get_redis()
        async for key in client.scan_iter("interview:*"):
            try:
                data = await get_session(key)
                if data and data.get("user_id") == uid:
                    await delete_session(key)
            except Exception:
                continue
    except Exception as e:
        logger.warning("Failed cleaning Redis for %s: %s", uid, e)

    try:
        await asyncio.to_thread(firebase_auth.delete_user, uid)
    except Exception as e:
        logger.warning("Failed deleting auth user %s: %s", uid, e)

    return {"message": "Account and interview data purged"}
