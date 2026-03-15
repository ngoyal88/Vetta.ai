from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from firebase_config import db

from utils.auth import verify_firebase_token
from utils.rate_limit import check_rate_limit
from utils.redis_client import get_session, delete_session
from utils.logger import get_logger

from . import router

logger = get_logger("InterviewHistoryRoutes")


def _serialize_firestore_timestamp(ts: Any) -> Any:
    """Convert Firestore timestamps to ISO strings for API responses."""
    if isinstance(ts, datetime):
        dt = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    # Firestore Timestamp objects expose to_datetime(); handle without tight coupling
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
    """Return recent interviews for the user from Firestore."""
    try:
        await check_rate_limit(uid, "history", limit=60, window_seconds=60)
        # Cap the limit to avoid heavy reads
        safe_limit = max(1, min(limit, 50))

        # Avoid Firestore composite index requirement by sorting in memory
        query = db.collection("interviews").where("user_id", "==", uid).limit(safe_limit)

        docs = query.stream()
        history = []
        for doc in docs:
            data = doc.to_dict() or {}
            data["id"] = doc.id
            for ts_key in ("started_at", "completed_at", "created_at", "last_updated"):
                if ts_key in data:
                    data[ts_key] = _serialize_firestore_timestamp(data.get(ts_key))
            history.append(data)

        # Sort client-side by start/completion time descending
        def _sort_key(item):
            ts = item.get("started_at") or item.get("created_at") or item.get("completed_at") or ""
            return ts.isoformat() if isinstance(ts, datetime) else str(ts)

        history.sort(key=_sort_key, reverse=True)

        return {"history": history}

    except Exception as e:
        logger.error(f"Error fetching history: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch interview history")


@router.get("/session/{session_id}")
async def get_session_details(
    session_id: str,
    uid: str = Depends(verify_firebase_token),
):
    """Get complete session details."""
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
    """Delete a stored interview history entry for the given user."""
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

        # Best-effort cleanup of Redis session
        try:
            await delete_session(f"interview:{session_id}")
        except Exception:
            pass

        return {"message": "Interview deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting interview history: {e}", exc_info=True)
        raise HTTPException(500, "Failed to delete interview")

