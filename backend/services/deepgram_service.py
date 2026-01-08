# backend/services/deepgram_service.py
"""backend/services/deepgram_service.py

Lean Deepgram realtime STT client using raw WebSocket via aiohttp.

Why: deepgram-sdk versions in the wild differ (v3 vs v5 APIs). The previous
implementation targeted v5, but hosts often ship an older build, causing the
socket not to emit transcripts. This version uses the stable WebSocket API
directly, keeping the surface area minimal and predictable.
"""
import asyncio
import contextlib
import json
from typing import Optional, Callable

import aiohttp

from utils.logger import get_logger
from config import get_settings

logger = get_logger("DeepgramService")
settings = get_settings()


class DeepgramSTTService:
    """Real-time Speech-to-Text using Deepgram"""

    def __init__(self, on_transcript: Callable[[str, bool], None]):
        self.on_transcript = on_transcript
        self.session: Optional[aiohttp.ClientSession] = None
        self.connection: Optional[aiohttp.ClientWebSocketResponse] = None
        self._listen_task: Optional[asyncio.Task] = None
        self._keepalive_task: Optional[asyncio.Task] = None
        self._last_audio_sent_at: Optional[float] = None
        self.is_connected = False

        if not settings.deepgram_api_key:
            raise ValueError("Deepgram API key not configured")

    async def connect(self) -> bool:
        """Establish WebSocket connection to Deepgram."""
        try:
            logger.info("🔌 Connecting to Deepgram realtime API (raw websocket)...")

            # aiohttp/yarl require str/int/float for query params; convert bools to lowercase strings.
            params = {
                "model": "nova-2",
                "language": "en-US",
                "smart_format": "true",
                "interim_results": "true",
                "vad_events": "true",
                "encoding": "linear16",
                "sample_rate": 16000,
                "channels": 1,
                # Keep endpoints short so interim results flush quickly.
                "endpointing": 300,
            }

            self.session = aiohttp.ClientSession()
            self.connection = await self.session.ws_connect(
                url="wss://api.deepgram.com/v1/listen",
                headers={"Authorization": f"Token {settings.deepgram_api_key}"},
                params=params,
                heartbeat=10,
                timeout=aiohttp.ClientTimeout(total=None),
                compress=0,
            )

            self.is_connected = True
            self._last_audio_sent_at = asyncio.get_running_loop().time()

            # Start listeners
            self._listen_task = asyncio.create_task(self._listen_loop())
            self._keepalive_task = asyncio.create_task(self._keepalive_loop())

            logger.info("✅ Deepgram websocket connected")
            return True

        except Exception as exc:  # pragma: no cover - network issues
            logger.error(f"❌ Deepgram connection error: {exc}", exc_info=True)
            await self.close()
            return False

    async def send_audio(self, audio_data: bytes):
        """Send audio chunk to Deepgram for transcription."""
        if not self.is_connected or not self.connection:
            logger.warning("⚠️ Cannot send audio: not connected")
            return

        try:
            if not hasattr(self, "_first_audio_logged"):
                logger.info(f"📤 Sending first audio chunk: {len(audio_data)} bytes")
                sample = audio_data[:200] if audio_data else b""
                non_zero = any(b != 0 for b in sample)
                logger.info(f"🔎 First chunk non-zero bytes: {non_zero}")
                self._first_audio_logged = True

            self._chunk_counter = getattr(self, "_chunk_counter", 0) + 1
            if self._chunk_counter % 50 == 0:
                sample = audio_data[:400] if audio_data else b""
                non_zero = any(b != 0 for b in sample)
                logger.info(f"🔎 Chunk {self._chunk_counter} non-zero bytes: {non_zero}")

            await self.connection.send_bytes(audio_data)
            self._last_audio_sent_at = asyncio.get_running_loop().time()
        except Exception as exc:
            logger.error(f"❌ Error sending audio: {exc}", exc_info=True)

    async def finalize(self):
        """Ask Deepgram to flush buffered transcripts."""
        await self._send_control({"type": "Finalize"})

    async def close(self):
        """Close Deepgram connection."""
        try:
            if self._listen_task is not None:
                self._listen_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self._listen_task

            if self._keepalive_task is not None:
                self._keepalive_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self._keepalive_task

            if self.connection is not None:
                with contextlib.suppress(Exception):
                    await self.connection.close()

            if self.session is not None:
                with contextlib.suppress(Exception):
                    await self.session.close()

            logger.info("🔌 Deepgram connection closed")
        finally:
            self.session = None
            self.connection = None
            self._listen_task = None
            self._keepalive_task = None
            self._last_audio_sent_at = None
            self.is_connected = False

    async def _listen_loop(self):
        """Receive messages from Deepgram and forward transcripts."""
        assert self.connection is not None

        async for msg in self.connection:
            if msg.type == aiohttp.WSMsgType.TEXT:
                await self._handle_message(msg.data)
            elif msg.type == aiohttp.WSMsgType.BINARY:
                # Deepgram should not send binary frames; log once.
                logger.debug("ℹ️ Received binary frame from Deepgram")
            elif msg.type == aiohttp.WSMsgType.ERROR:
                logger.error(f"❌ Deepgram websocket error: {self.connection.exception()}")
                break
            elif msg.type == aiohttp.WSMsgType.CLOSED:
                logger.info("🔌 Deepgram websocket closed by server")
                break

    async def _handle_message(self, data: str):
        try:
            payload = json.loads(data)
        except Exception:
            logger.debug("⚠️ Non-JSON message from Deepgram")
            return

        msg_type = payload.get("type")

        if msg_type == "Results":
            channel = payload.get("channel") or {}
            alternatives = channel.get("alternatives") or []
            transcript = (alternatives[0].get("transcript") or "").strip() if alternatives else ""
            is_final = bool(payload.get("is_final") or payload.get("speech_final"))

            if transcript:
                logger.info(f"📝 Transcript ({'FINAL' if is_final else 'interim'}): '{transcript}'")
                if self.on_transcript:
                    self.on_transcript(transcript, is_final)
        elif msg_type == "Metadata":
            logger.info("ℹ️ Deepgram metadata received")
        elif msg_type == "Error":
            message = payload.get("message") or "Deepgram error"
            logger.error(f"❌ Deepgram returned error: {message}")
        else:
            # Throttle noisy logs.
            self._msg_counter = getattr(self, "_msg_counter", 0) + 1
            if self._msg_counter <= 3:
                logger.info(f"ℹ️ Deepgram message type={msg_type}")

    async def _keepalive_loop(self):
        interval_s = 4.0
        max_silence_s = 6.0

        while True:
            await asyncio.sleep(interval_s)

            if not self.is_connected or not self.connection:
                continue

            now = asyncio.get_running_loop().time()
            last = self._last_audio_sent_at or now
            if now - last < max_silence_s:
                continue

            await self._send_control({"type": "KeepAlive"})

    async def _send_control(self, payload: dict):
        if not self.connection:
            return
        try:
            await self.connection.send_str(json.dumps(payload))
        except Exception as exc:
            logger.warning(f"⚠️ Failed to send control message to Deepgram: {exc}")