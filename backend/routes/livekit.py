"""LiveKit HTTP routes: token generation and session attach."""
import asyncio
import json
from datetime import timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from config import get_settings
from utils.auth import verify_firebase_token
from utils.logger import get_logger
from utils.redis_client import get_session, redis

router = APIRouter(prefix="/livekit", tags=["LiveKit"])
log = get_logger(__name__)
settings = get_settings()

_BOT_LOCK_KEY = "bot_lock:{session_id}"
_BOT_LOCK_TTL = 300

ACTIVE_BOT_TASKS: Dict[str, asyncio.Task] = {}


def _require_livekit() -> None:
    if not (settings.livekit_api_key and settings.livekit_api_secret and settings.livekit_url):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LiveKit is not configured",
        )


def _livekit_api():
    from livekit import api as lk_api
    return lk_api


async def _acquire_bot_lock(session_id: str) -> bool:
    key = _BOT_LOCK_KEY.format(session_id=session_id)
    try:
        return await redis.set(key, "1", nx=True, ex=_BOT_LOCK_TTL)
    except Exception as e:
        log.error("Failed to acquire bot lock for %s: %s", session_id, e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Bot lock backend unavailable",
        )


async def _release_bot_lock(session_id: str) -> None:
    key = _BOT_LOCK_KEY.format(session_id=session_id)
    try:
        await redis.delete(key)
    except Exception as e:
        log.warning("Failed to release bot lock for %s: %s", session_id, e)


class LiveKitTokenRequest(BaseModel):
    session_id: str
    user_id: str | None = None


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str
    room_name: str


class LiveKitAttachRequest(BaseModel):
    session_id: str = ""
    sessionId: str | None = None


async def _resolve_session(session_id: str, uid: str) -> Dict[str, Any]:
    """Load and authorise a session; raises 404/403 on failure."""
    session_data = await get_session(f"interview:{session_id}")
    if not session_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    owner = session_data.get("user_id") or session_data.get("uid")
    if owner and str(owner) != str(uid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session does not belong to you")
    return session_data


@router.post("/token", response_model=LiveKitTokenResponse)
async def create_livekit_token(
    body: LiveKitTokenRequest,
    uid: str = Depends(verify_firebase_token),
) -> LiveKitTokenResponse:
    """Mint a LiveKit room token for the user; room name equals session_id."""
    _require_livekit()

    room_name = (body.session_id or "").strip()
    if not room_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id is required")
    if body.user_id and body.user_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_id mismatch")

    await _resolve_session(room_name, uid)

    lk_api = _livekit_api()
    jwt = (
        lk_api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(uid)
        .with_grants(lk_api.VideoGrants(room_join=True, room=room_name))
        .with_ttl(timedelta(hours=4))
        .to_jwt()
    )

    return LiveKitTokenResponse(token=jwt, url=settings.livekit_url, room_name=room_name)


@router.post("/attach")
async def livekit_attach(
    body: LiveKitAttachRequest,
    uid: str = Depends(verify_firebase_token),
) -> Dict[str, Any]:
    """Acknowledge room join. In agent-worker mode this is a no-op."""
    _require_livekit()

    session_id = (body.session_id or body.sessionId or "").strip()
    if not session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id is required")

    await _resolve_session(session_id, uid)

    if getattr(settings, "use_agent_worker_v2", False):
        return {"status": "ok", "message": "Agent worker mode; attach skipped"}

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

    def _cleanup(t: asyncio.Task, sid: str = session_id) -> None:
        asyncio.create_task(_release_bot_lock(sid))
        if ACTIVE_BOT_TASKS.get(sid) is t:
            ACTIVE_BOT_TASKS.pop(sid, None)

    task.add_done_callback(_cleanup)
    return {"status": "ok", "message": "Bot joining room"}


@router.post("/prewarm")
async def livekit_prewarm(
    body: LiveKitAttachRequest,
    uid: str = Depends(verify_firebase_token),
) -> Dict[str, Any]:
    """Pre-warm the interview bot before the user joins. No-op in agent-worker mode."""
    _require_livekit()

    session_id = (body.session_id or body.sessionId or "").strip()
    if not session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id is required")

    await _resolve_session(session_id, uid)

    if getattr(settings, "use_agent_worker_v2", False):
        return {"status": "ok", "session_id": session_id, "message": "Agent worker mode; prewarm skipped"}

    acquired = await _acquire_bot_lock(session_id)
    if not acquired:
        return {"status": "already_warming", "session_id": session_id}

    from services.interview.livekit_room_handler import run_livekit_room_handler

    task = asyncio.create_task(run_livekit_room_handler(session_id, uid, prewarm=True))
    ACTIVE_BOT_TASKS[session_id] = task

    def _cleanup(t: asyncio.Task, sid: str = session_id) -> None:
        asyncio.create_task(_release_bot_lock(sid))
        if ACTIVE_BOT_TASKS.get(sid) is t:
            ACTIVE_BOT_TASKS.pop(sid, None)

    task.add_done_callback(_cleanup)
    return {"status": "warming", "session_id": session_id}


@router.get("/health")
async def livekit_health() -> Dict[str, Any]:
    livekit_configured = bool(
        settings.livekit_api_key and settings.livekit_api_secret and settings.livekit_url
    )
    return {"status": "ok", "livekit_configured": livekit_configured}
