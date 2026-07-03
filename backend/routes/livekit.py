"""LiveKit HTTP routes: token generation and agent-worker attach."""
import json
from datetime import timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from config import get_settings
from utils.auth import verify_firebase_token
from utils.http_errors import raise_internal_error
from utils.logger import get_logger
from utils.rate_limit import check_rate_limit
from utils.redis_client import get_session
from utils.session_access import require_session_owner

router = APIRouter(prefix="/livekit", tags=["LiveKit"])
log = get_logger(__name__)
settings = get_settings()


def _require_livekit() -> None:
    if not (settings.livekit_api_key and settings.livekit_api_secret and settings.livekit_url):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LiveKit is not configured",
        )


def _livekit_api():
    from livekit import api as lk_api
    return lk_api


class LiveKitTokenRequest(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    dispatch_agent: bool = False


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str
    room_name: str


class LiveKitAttachRequest(BaseModel):
    session_id: str = ""
    sessionId: Optional[str] = None


async def _resolve_session(session_id: str, uid: str) -> Dict[str, Any]:
    """Load and authorise a session; raises 404/403/410 on failure."""
    session_data = await get_session(f"interview:{session_id}")
    if session_data is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Interview session expired. Please start a new interview.",
        )
    return require_session_owner(session_data, uid)


def _livekit_token_ttl() -> timedelta:
    session_seconds = int(getattr(settings, "interview_session_ttl_seconds", 7200))
    return timedelta(seconds=session_seconds + 300)


def _agent_name() -> str:
    return (getattr(settings, "livekit_agent_name", "") or "vetta-interviewer").strip()


def _dispatch_metadata(session_id: str, uid: str) -> str:
    return json.dumps({"session_id": session_id, "user_id": uid})


@router.post("/token", response_model=LiveKitTokenResponse)
async def create_livekit_token(
    body: LiveKitTokenRequest,
    uid: str = Depends(verify_firebase_token),
) -> LiveKitTokenResponse:
    """Mint a LiveKit room token for the user; room name equals session_id."""
    _require_livekit()
    await check_rate_limit(uid, "livekit_token", limit=20, window_seconds=60)

    room_name = (body.session_id or "").strip()
    if not room_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id is required")
    if body.user_id and body.user_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_id mismatch")

    try:
        await _resolve_session(room_name, uid)

        lk_api = _livekit_api()
        token = (
            lk_api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
            .with_identity(uid)
            .with_grants(lk_api.VideoGrants(room_join=True, room=room_name))
            .with_ttl(_livekit_token_ttl())
        )
        if body.dispatch_agent:
            token = token.with_room_config(
                lk_api.RoomConfiguration(
                    agents=[
                        lk_api.RoomAgentDispatch(
                            agent_name=_agent_name(),
                            metadata=_dispatch_metadata(room_name, uid),
                        )
                    ]
                )
            )
        jwt = token.to_jwt()
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_error(log, exc, message="Failed to create LiveKit token")

    return LiveKitTokenResponse(token=jwt, url=settings.livekit_url, room_name=room_name)


@router.post("/attach")
async def livekit_attach(
    body: LiveKitAttachRequest,
    uid: str = Depends(verify_firebase_token),
) -> Dict[str, Any]:
    """Acknowledge room join for agent-worker mode."""
    _require_livekit()
    await check_rate_limit(uid, "livekit_attach", limit=20, window_seconds=60)

    session_id = (body.session_id or body.sessionId or "").strip()
    if not session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id is required")

    await _resolve_session(session_id, uid)

    lk_api = _livekit_api()
    agent_name = _agent_name()
    async with lk_api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
    ) as client:
        existing = await client.agent_dispatch.list_dispatch(session_id)
        for dispatch in existing:
            if getattr(dispatch, "agent_name", "") == agent_name:
                return {
                    "status": "ok",
                    "message": "Agent worker already dispatched",
                    "dispatch_id": getattr(dispatch, "id", ""),
                    "agent_name": agent_name,
                }

        dispatch = await client.agent_dispatch.create_dispatch(
            lk_api.CreateAgentDispatchRequest(
                agent_name=agent_name,
                room=session_id,
                metadata=_dispatch_metadata(session_id, uid),
            )
        )

    return {
        "status": "ok",
        "message": "Agent worker dispatched",
        "dispatch_id": getattr(dispatch, "id", ""),
        "agent_name": agent_name,
    }


@router.get("/health")
async def livekit_health() -> Dict[str, Any]:
    livekit_configured = bool(
        settings.livekit_api_key and settings.livekit_api_secret and settings.livekit_url
    )
    return {"status": "ok", "livekit_configured": livekit_configured}
