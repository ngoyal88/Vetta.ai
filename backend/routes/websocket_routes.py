# backend/routes/websocket_routes.py
"""
WebSocket routes for real-time interview
"""
import asyncio
import contextlib
import json

from fastapi import APIRouter, WebSocket
from firebase_admin import auth as firebase_auth

from config import get_settings
from services.deepgram_service import DeepgramSTTService
from services.interview_websocket import InterviewWebSocketHandler
from utils.logger import get_logger

router = APIRouter(prefix="/ws", tags=["WebSocket"])
logger = get_logger("WebSocketRoutes")
settings = get_settings()


@router.websocket("/interview/{session_id}")
async def interview_websocket(
    websocket: WebSocket,
    session_id: str
):
    """
    WebSocket endpoint for real-time interview
    
    Client sends:
    - Audio chunks (bytes)
    - Control messages (JSON)
    
    Server sends:
    - Questions with audio
    - Transcripts
    - Status updates
    - Feedback
    """
    # Auth: try Firebase ID token via Authorization header; fallback to API_TOKEN query/header
    expected_api_token = settings.api_token or None
    auth_header = websocket.headers.get("authorization") or ""
    header_parts = auth_header.split()
    header_token = header_parts[1] if len(header_parts) == 2 and header_parts[0].lower() == "bearer" else None
    query_token = websocket.query_params.get("token")

    uid = None
    # Prefer Firebase token if present
    if header_token:
        try:
            decoded = firebase_auth.verify_id_token(header_token)
            uid = decoded.get("uid")
        except Exception:
            uid = None

    # Fallback to API token (for testing tools)
    if uid is None and expected_api_token:
        if header_token == expected_api_token or query_token == expected_api_token:
            uid = "api_token_user"

    if not uid:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Unauthorized"})
        await websocket.close(code=1008)
        return

    handler = InterviewWebSocketHandler(websocket, session_id, user_id=uid)
    await handler.handle_connection()


@router.websocket("/stt")
async def stt_websocket(websocket: WebSocket):
    """Minimal STT-only websocket for debugging Deepgram.

    Client sends:
    - Binary frames: raw PCM16 audio bytes (16kHz, mono)
    - Text frames (JSON): {"type":"ping"|"stop"}

    Server sends (JSON):
    - {"type":"transcript","text":...,"is_final":...}
    - {"type":"status","status":...}
    - {"type":"error","message":...}
    """
    # Auth: browsers can't set custom headers for WebSocket.
    # Accept either:
    # - Authorization: Bearer <api_token>
    # - Query string: /ws/stt?token=<api_token>
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
        # Deepgram callback is sync; schedule async send.
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
                # Allow plain-text stop/ping for convenience
                msg = {"type": (text_payload or "").strip()}

            msg_type = (msg.get("type") or "").strip().lower()
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type in ("stop", "stop_recording", "answer_complete"):
                await send_status("finalizing")
                await stt.finalize()
                # Give Deepgram a brief window to emit final transcript(s)
                await asyncio.sleep(0.5)
                await send_status("done")
                break
            elif msg_type in ("close", "disconnect", "end"):
                break

    except Exception as e:
        logger.error(f"❌ STT websocket error: {e}", exc_info=True)
        with contextlib.suppress(Exception):
            await websocket.send_json({"type": "error", "message": "STT websocket error"})
    finally:
        await stt.close()
        with contextlib.suppress(Exception):
            await websocket.close()