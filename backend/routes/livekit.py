"""
LiveKit HTTP routes: token and attach (transport only; no worker).
"""
import json
from typing import Any, Dict
from datetime import timedelta
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from config import get_settings
from utils.auth import verify_firebase_token
from utils.logger import get_logger
from utils.redis_client import get_session, redis

router = APIRouter(prefix="/livekit", tags=["LiveKit"])
log = get_logger(__name__)
settings = get_settings()

# In-process bot task registry. This prevents duplicate handler tasks for the same session
# when the client retries attach during refresh/reconnect windows.
ACTIVE_BOT_TASKS: Dict[str, asyncio.Task] = {}

BOT_LOCK_KEY = "bot_lock:{session_id}"
BOT_LOCK_TTL = 300


async def _acquire_bot_lock(session_id: str) -> bool:
    key = BOT_LOCK_KEY.format(session_id=session_id)
    try:
        return await redis.set(key, "1", nx=True, ex=BOT_LOCK_TTL)
    except Exception as e:
        # Distinguish backend/Redis errors from normal lock contention.
        # Attach handler treats a falsy return as "session already active"
        # so we raise a 503 here to indicate a dependency failure instead.
        log.error("Failed to acquire bot lock for %s: %s", session_id, e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Bot lock backend unavailable",
        )


async def _release_bot_lock(session_id: str) -> None:
    key = BOT_LOCK_KEY.format(session_id=session_id)
    try:
        await redis.delete(key)
    except Exception as e:
        log.warning("Failed to release bot lock for %s: %s", session_id, e)


def _livekit_api():
    """Lazy import so FastAPI can start without livekit-api."""
    from livekit import api as lk_api
    return lk_api


class LiveKitTokenRequest(BaseModel):
    session_id: str
    user_id: str | None = None


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str
    room_name: str


@router.post("/token", response_model=LiveKitTokenResponse)
async def create_livekit_token(
    body: LiveKitTokenRequest,
    uid: str = Depends(verify_firebase_token),
) -> LiveKitTokenResponse:
    """Mint a LiveKit room token for the user; room name = session_id."""
    if not settings.livekit_api_key or not settings.livekit_api_secret or not settings.livekit_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LiveKit is not configured",
        )

    room_name = (body.session_id or "").strip()
    if not room_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id is required")

    if body.user_id and body.user_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_id mismatch")

    session_key = f"interview:{room_name}"
    session_data = await get_session(session_key)
    if not session_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    lk_api = _livekit_api()
    token = lk_api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
    token = token.with_identity(uid).with_grants(
        lk_api.VideoGrants(room_join=True, room=room_name)
    ).with_ttl(timedelta(hours=4))
    jwt = token.to_jwt()

    return LiveKitTokenResponse(token=jwt, url=settings.livekit_url, room_name=room_name)


class LiveKitAttachRequest(BaseModel):
    session_id: str = ""
    sessionId: str | None = None  # frontend may send camelCase


@router.post("/attach")
async def livekit_attach(
    body: LiveKitAttachRequest,
    uid: str = Depends(verify_firebase_token),
) -> Dict[str, Any]:
    """
    Spawn the bot into the room. Call after the client has connected to the room.
    Validates session exists and belongs to the user, then starts the room handler in background.
    """
    if not settings.livekit_api_key or not settings.livekit_api_secret or not settings.livekit_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LiveKit is not configured",
        )

    session_id = (body.session_id or (body.sessionId or "")).strip()
    if not session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id is required")

    session_key = f"interview:{session_id}"
    session_data = await get_session(session_key)
    if not session_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session_user_id = session_data.get("user_id") or session_data.get("uid")
    if session_user_id and str(session_user_id) != str(uid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session does not belong to you")

    acquired = await _acquire_bot_lock(session_id)
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "session_already_active",
                "message": "Interview is already running in another tab",
            },
        )

    from services.interview.livekit_room_handler import run_livekit_room_handler
    task = asyncio.create_task(run_livekit_room_handler(session_id, uid, prewarm=False))
    ACTIVE_BOT_TASKS[session_id] = task

    def _cleanup_task(_task: asyncio.Task, sid: str = session_id) -> None:
        asyncio.create_task(_release_bot_lock(sid))
        current = ACTIVE_BOT_TASKS.get(sid)
        if current is _task:
            ACTIVE_BOT_TASKS.pop(sid, None)

    task.add_done_callback(_cleanup_task)

    return {"status": "ok", "message": "Bot joining room"}


@router.post("/prewarm")
async def livekit_prewarm(
    body: LiveKitAttachRequest,
    uid: str = Depends(verify_firebase_token),
) -> Dict[str, Any]:
    """
    Pre-warm the interview bot and greeting before the user joins the room.
    Uses same validation as attach. If bot lock cannot be acquired, returns 200 with already_warming.
    """
    if not settings.livekit_api_key or not settings.livekit_api_secret or not settings.livekit_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LiveKit is not configured",
        )

    session_id = (body.session_id or (body.sessionId or "")).strip()
    if not session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id is required")

    session_key = f"interview:{session_id}"
    session_data = await get_session(session_key)
    if not session_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session_user_id = session_data.get("user_id") or session_data.get("uid")
    if session_user_id and str(session_user_id) != str(uid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session does not belong to you")

    acquired = await _acquire_bot_lock(session_id)
    if not acquired:
        return {"status": "already_warming", "session_id": session_id}

    from services.interview.livekit_room_handler import run_livekit_room_handler
    task = asyncio.create_task(run_livekit_room_handler(session_id, uid, prewarm=True))
    ACTIVE_BOT_TASKS[session_id] = task

    def _cleanup_task(_task: asyncio.Task, sid: str = session_id) -> None:
        asyncio.create_task(_release_bot_lock(sid))
        current = ACTIVE_BOT_TASKS.get(sid)
        if current is _task:
            ACTIVE_BOT_TASKS.pop(sid, None)

    task.add_done_callback(_cleanup_task)

    return {"status": "warming", "session_id": session_id}


@router.get("/health")
async def livekit_health() -> Dict[str, Any]:
    """Probe for frontend: is LiveKit configured and available."""
    livekit_configured = bool(
        settings.livekit_api_key and settings.livekit_api_secret and settings.livekit_url
    )
    return {"status": "ok", "livekit_configured": livekit_configured}
