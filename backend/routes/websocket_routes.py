# LiveKit-failure fallback: /ws/interview/{session_id} (frozen — do not extend).
# Primary interview transport is services/interview/agent/ (LiveKit).
# Mount controlled by interview_websocket_fallback_enabled in config.py.
"""
WebSocket routes for interview fallback when LiveKit is unavailable.
"""
import asyncio
import contextlib
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, WebSocket
from firebase_admin import auth as firebase_auth

from config import get_settings
from services.integrations import DeepgramSTTService
from services.interview import InterviewWebSocketHandler
from utils.logger import get_logger
from utils.redis_client import get_session

router = APIRouter(prefix="/ws", tags=["WebSocket"])
logger = get_logger("WebSocketRoutes")
settings = get_settings()


def session_authorized_for_ws(session_data: Optional[Dict[str, Any]], uid: str) -> bool:
    """Fail-closed ownership check for WS fallback (mirrors require_session_owner)."""
    if not session_data:
        return False
    owner = session_data.get("user_id") or session_data.get("uid")
    if not owner:
        return False
    return str(owner) == str(uid)


async def _reject_websocket(websocket: WebSocket, message: str, code: int = 1008) -> None:
    await websocket.accept()
    await websocket.send_json({"type": "error", "message": message})
    await websocket.close(code=code)


async def _handle_interview_websocket(websocket: WebSocket, session_id: str) -> None:
    """
    WebSocket fallback endpoint for real-time interview when LiveKit is unavailable.

    Client sends audio chunks (bytes) and control messages (JSON).
    Server sends questions, transcripts, status, and feedback.
    """
    if not settings.interview_websocket_fallback_enabled:
        await _reject_websocket(websocket, "WebSocket fallback is disabled")
        return

    expected_api_token = settings.api_token or None
    auth_header = websocket.headers.get("authorization") or ""
    header_parts = auth_header.split()
    header_token = header_parts[1] if len(header_parts) == 2 and header_parts[0].lower() == "bearer" else None
    query_token = websocket.query_params.get("token")

    uid = None
    if header_token:
        try:
            decoded = firebase_auth.verify_id_token(header_token)
            uid = decoded.get("uid")
        except Exception:
            uid = None

    if uid is None and query_token:
        try:
            decoded = firebase_auth.verify_id_token(query_token)
            uid = decoded.get("uid")
        except Exception:
            uid = None

    if uid is None and expected_api_token:
        if header_token == expected_api_token or query_token == expected_api_token:
            uid = "api_token_user"

    if not uid:
        await _reject_websocket(websocket, "Unauthorized")
        return

    session_data = await get_session(f"interview:{session_id}")
    if not session_authorized_for_ws(session_data, uid):
        await _reject_websocket(websocket, "Session not found or not authorized", code=1008)
        return

    if not settings.deepgram_api_key:
        await _reject_websocket(websocket, "Speech service not configured", code=1011)
        return

    handler = InterviewWebSocketHandler(websocket, session_id, user_id=uid)
    await handler.handle_connection()


@router.websocket("/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    await _handle_interview_websocket(websocket, session_id)


@router.websocket("/stt")
async def stt_websocket(websocket: WebSocket):
    """Minimal STT-only websocket for debugging Deepgram."""
    expected_token = settings.api_token or None
    got_header = websocket.headers.get("authorization")
    got_query = websocket.query_params.get("token")

    await websocket.accept()

    if expected_token:
        header_ok = got_header == f"Bearer {expected_token}"
        query_ok = got_query == expected_token
        if not (header_ok or query_ok):
            await websocket.send_json({"type": "error", "message": "Unauthorized"})
            await websocket.close(code=1008)
            return

    async def send_status(status: str):
        try:
            await websocket.send_json({"type": "status", "status": status})
        except Exception:
            pass

    def on_transcript(text: str, is_final: bool):
        async def _send():
            await websocket.send_json({"type": "transcript", "text": text, "is_final": is_final})

        asyncio.create_task(_send())

    stt = DeepgramSTTService(on_transcript=on_transcript)
    if not await stt.connect():
        await websocket.send_json({"type": "error", "message": "Failed to connect to Deepgram"})
        await websocket.close(code=1011)
        return

    await send_status("listening")

    try:
        while True:
            data = await websocket.receive()
            text_payload = data.get("text")
            bytes_payload = data.get("bytes")

            if bytes_payload is not None:
                await stt.send_audio(bytes_payload)
                continue

            if text_payload is None:
                continue

            try:
                msg = json.loads(text_payload)
            except Exception:
                msg = {"type": (text_payload or "").strip()}

            msg_type = (msg.get("type") or "").strip().lower()
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type in ("stop", "stop_recording", "answer_complete"):
                await send_status("finalizing")
                await stt.finalize()
                await asyncio.sleep(0.5)
                await send_status("done")
                break
            elif msg_type in ("close", "disconnect", "end"):
                break

    except Exception as e:
        logger.error(f"STT websocket error: {e}", exc_info=True)
        with contextlib.suppress(Exception):
            await websocket.send_json({"type": "error", "message": "STT websocket error"})
    finally:
        await stt.close()
        with contextlib.suppress(Exception):
            await websocket.close()
