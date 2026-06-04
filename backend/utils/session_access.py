"""Fail-closed session ownership checks for interview Redis sessions."""

from typing import Any

from fastapi import HTTPException


def require_session_owner(session_data: dict[str, Any] | None, uid: str) -> dict[str, Any]:
    """
    Ensure the authenticated user owns the session.

    All interview routes that read Redis session state must call this helper.
    Missing owner fields are treated as unauthorized (403), not public access.
    """
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    owner = session_data.get("user_id") or session_data.get("uid")
    if not owner:
        raise HTTPException(status_code=403, detail="Session ownership could not be verified")

    if str(owner) != str(uid):
        raise HTTPException(status_code=403, detail="Not authorized for this session")

    return session_data
