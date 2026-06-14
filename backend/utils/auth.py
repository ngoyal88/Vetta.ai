from __future__ import annotations

import time
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from firebase_admin import auth as firebase_auth

from config import get_settings

_RECENT_AUTH_MAX_AGE_SECONDS = 300


def _bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization") or ""
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Missing bearer token",
        )
    return parts[1]


def _decode_firebase_token(request: Request) -> dict[str, Any]:
    token = _bearer_token(request)
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid token",
        ) from None
    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid token",
        )
    return decoded


def _require_email_verified(claims: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.require_email_verified():
        return
    if not claims.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified",
        )


def _require_recent_auth(claims: dict[str, Any], *, max_age_seconds: int = _RECENT_AUTH_MAX_AGE_SECONDS) -> None:
    auth_time = claims.get("auth_time")
    if auth_time is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recent sign-in required",
        )
    try:
        auth_ts = int(auth_time)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recent sign-in required",
        ) from None
    if time.time() - auth_ts > max_age_seconds:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recent sign-in required. Please sign in again and retry.",
        )


async def verify_firebase_token(request: Request) -> str:
    """Validate Firebase ID token and return the UID."""
    claims = _decode_firebase_token(request)
    _require_email_verified(claims)
    return str(claims["uid"])


async def verify_recent_firebase_token(request: Request) -> str:
    """Validate token and require authentication within the last few minutes."""
    claims = _decode_firebase_token(request)
    _require_email_verified(claims)
    _require_recent_auth(claims)
    return str(claims["uid"])
