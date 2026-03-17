from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException

from firebase_config import db
from utils.auth import verify_firebase_token
from utils.logger import get_logger
from utils.rate_limit import check_rate_limit
from utils.redis_client import delete_session, get_session

from . import router

logger = get_logger("InterviewHistoryRoutes")


def _serialize_ts(ts: Any) -> Any:
    """Convert Firestore Timestamp or datetime to an ISO 8601 string."""
    if isinstance(ts, datetime):
        dt = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    if hasattr(ts, "to_datetime"):
        try:
            dt = ts.to_datetime()
            if isinstance(dt, datetime):
                dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
                return dt.isoformat()
        except Exception:
            pass
    return ts


@router.get("/history")
async def get_interview_history(
    limit: int = 20,
    uid: str = Depends(verify_firebase_token),
):
    """Return recent interviews for the authenticated user from Firestore."""
    try:
        await check_rate_limit(uid, "history", limit=60, window_seconds=60)
        safe_limit = max(1, min(limit, 50))

        docs = db.collection("interviews").where("user_id", "==", uid).limit(safe_limit).stream()
        history = []
        for doc in docs:
            data = doc.to_dict() or {}
            data["id"] = doc.id
            for key in ("started_at", "completed_at", "created_at", "last_updated"):
                if key in data:
                    data[key] = _serialize_ts(data[key])
            history.append(data)

        def _sort_key(item):
            ts = item.get("started_at") or item.get("created_at") or item.get("completed_at") or ""
            return ts.isoformat() if isinstance(ts, datetime) else str(ts)

        history.sort(key=_sort_key, reverse=True)
        return {"history": history}

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
        session_data = await get_session(f"interview:{session_id}")
        if not session_data:
            raise HTTPException(404, "Session not found")
        if session_data.get("user_id") and session_data.get("user_id") != uid:
            raise HTTPException(403, "Not authorized for this session")
        return session_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/history/{session_id}")
async def delete_interview_history(
    session_id: str,
    uid: str = Depends(verify_firebase_token),
):
    """Delete an interview history entry for the authenticated user."""
    try:
        await check_rate_limit(uid, "delete", limit=20, window_seconds=60)

        doc_ref = db.collection("interviews").document(session_id)
        snapshot = doc_ref.get()
        if not snapshot.exists:
            raise HTTPException(404, "Interview not found")

        data = snapshot.to_dict() or {}
        if data.get("user_id") != uid:
            raise HTTPException(403, "Not authorized to delete this interview")

        doc_ref.delete()

        try:
            await delete_session(f"interview:{session_id}")
        except Exception:
            pass

        return {"message": "Interview deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting interview history: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to delete interview")
