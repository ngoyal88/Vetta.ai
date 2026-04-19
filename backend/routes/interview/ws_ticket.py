"""Short-lived opaque tickets for legacy WebSocket auth (avoids Firebase JWT in query strings)."""
import secrets

from fastapi import Depends
from pydantic import BaseModel

from utils.auth import verify_firebase_token
from utils.redis_client import WS_TICKET_TTL_SECONDS, store_ws_ticket

from . import router


class WsTicketResponse(BaseModel):
    ticket: str
    expires_in: int


@router.post("/ws-ticket", response_model=WsTicketResponse)
async def issue_ws_ticket(uid: str = Depends(verify_firebase_token)) -> WsTicketResponse:
    """Exchange a Firebase ID token (Authorization header) for a one-time WebSocket ticket."""
    ticket = secrets.token_urlsafe(32)
    await store_ws_ticket(ticket, uid, ttl_seconds=WS_TICKET_TTL_SECONDS)
    return WsTicketResponse(ticket=ticket, expires_in=WS_TICKET_TTL_SECONDS)
