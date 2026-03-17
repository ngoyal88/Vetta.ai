# DEPRECATED: Raw-WebSocket Deepgram client used by the legacy interview_websocket handler.
# Deepgram is now consumed via livekit.plugins.deepgram inside the AgentSession. Can be deleted.
"""
Lean Deepgram realtime STT client using raw WebSocket via aiohttp.

Why: deepgram-sdk versions in the wild differ (v3 vs v5 APIs). The previous
implementation targeted v5, but hosts often ship an older build, causing the
socket not to emit transcripts. This version uses the stable WebSocket API
directly, keeping the surface area minimal and predictable.
"""
import asyncio
import contextlib
import json
from typing import Awaitable, Callable, List, Optional

import aiohttp

from utils.logger import get_logger
from config import get_settings

logger = get_logger("DeepgramService")
settings = get_settings()


class DeepgramSTTService:
    """Real-time Speech-to-Text using Deepgram"""

    def __init__(
        self,
        on_transcript: Callable[[str, bool], None],
        on_result: Optional[Callable[[str, bool, Optional[float]], None]] = None,
        on_speech_started: Optional[Callable[[], None]] = None,
        on_utterance_end: Optional[Callable[[Optional[int]], None]] = None,
    ):
        self.on_transcript = on_transcript
        self.on_result = on_result
        self.on_speech_started = on_speech_started
        self.on_utterance_end = on_utterance_end
        self.session: Optional[aiohttp.ClientSession] = None
        self.connection: Optional[aiohttp.ClientWebSocketResponse] = None
        self._listen_task: Optional[asyncio.Task] = None
        self._keepalive_task: Optional[asyncio.Task] = None
        self._last_audio_sent_at: Optional[float] = None
        self.is_connected = False
        self._reconnect_attempts = 0
        self._max_reconnect_attempts = 3
        self._is_reconnecting = False
        self._reconnect_callbacks: List[Callable[[str, int], Awaitable[None]]] = []  # (status, attempt)

        if not settings.deepgram_api_key:
            raise ValueError("Deepgram API key not configured")

    async def connect(self) -> bool:
        """Establish WebSocket connection to Deepgram."""
        try:
            logger.info("🔌 Connecting to Deepgram realtime API (raw websocket)...")

            # aiohttp/yarl require str/int/float for query params; convert bools to lowercase strings.
            params = {
                "model": getattr(settings, "deepgram_model", "nova-2") or "nova-2",
                "language": "en-US",
                "smart_format": "true",
                "interim_results": "true",
                "vad_events": "true",
                "encoding": "linear16",
                "sample_rate": 16000,
                "channels": 1,
                # Keep endpoints short so interim results flush quickly.
                "endpointing": getattr(settings, "deepgram_endpointing_ms", 500),
                "utterance_end_ms": getattr(settings, "deepgram_utterance_end_ms", 2000),
            }

            # Explicit longer sock_connect/sock_read for slow networks and Windows (avoids WinError 121 semaphore timeout).
            timeout = aiohttp.ClientTimeout(sock_connect=60, sock_read=60, total=120)
            self.session = aiohttp.ClientSession()
            self.connection = await self.session.ws_connect(
                url="wss://api.deepgram.com/v1/listen",
                headers={"Authorization": f"Token {settings.deepgram_api_key}"},
                params=params,
                heartbeat=10,
                timeout=timeout,
                compress=0,
            )

            self.is_connected = True
            self._last_audio_sent_at = asyncio.get_running_loop().time()
            self._reconnect_attempts = 0

            # Start listeners
            self._listen_task = asyncio.create_task(self._listen_loop())
            self._keepalive_task = asyncio.create_task(self._keepalive_loop())

            logger.info("✅ Deepgram websocket connected")
            return True

        except Exception as exc:  # pragma: no cover - network issues
            logger.error(f"❌ Deepgram connection error: {exc}", exc_info=True)
            await self.close()
            return False

    def register_reconnect_callback(self, callback: Callable[[str, int], Awaitable[None]]) -> None:
        """Register an async callback(status, attempt) for reconnect events: reconnecting_stt, stt_restored, stt_unavailable."""
        self._reconnect_callbacks.append(callback)

    async def _notify_reconnect_status(self, status: str, attempt: int) -> None:
        for cb in self._reconnect_callbacks:
            try:
                result = cb(status, attempt)
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.warning("Reconnect callback error: %s", e)

    async def _handle_disconnect(self) -> None:
        """Exponential backoff reconnect (0.5, 1.5, 3s), up to 3 attempts; notify callbacks."""
        if self._is_reconnecting:
            return
        self._is_reconnecting = True
        try:
            if self._keepalive_task:
                self._keepalive_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self._keepalive_task
                self._keepalive_task = None
            if self.connection:
                with contextlib.suppress(Exception):
                    await self.connection.close()
                self.connection = None
            if self.session:
                with contextlib.suppress(Exception):
                    await self.session.close()
                self.session = None
            self.is_connected = False

            delays = [0.5, 1.5, 3.0]
            for attempt in range(1, self._max_reconnect_attempts + 1):
                await self._notify_reconnect_status("reconnecting_stt", attempt)
                await asyncio.sleep(delays[attempt - 1] if attempt <= len(delays) else 3.0)
                if await self.connect():
                    await self._notify_reconnect_status("stt_restored", attempt)
                    self._reconnect_attempts = 0
                    return
            await self._notify_reconnect_status("stt_unavailable", self._max_reconnect_attempts)
        finally:
            self._is_reconnecting = False

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
            self.is_connected = False
            raise

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

        try:
            async for msg in self.connection:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    await self._handle_message(msg.data)
                elif msg.type == aiohttp.WSMsgType.BINARY:
                    # Deepgram should not send binary frames; log once.
                    logger.debug("ℹ️ Received binary frame from Deepgram")
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error("❌ Deepgram websocket error: %s", self.connection.exception())
                    self.is_connected = False
                    break
                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    logger.info("🔌 Deepgram websocket closed by server")
                    self.is_connected = False
                    break
        finally:
            self.is_connected = False
            asyncio.create_task(self._handle_disconnect())

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
            confidence = alternatives[0].get("confidence") if alternatives else None
            is_final = bool(payload.get("is_final") or payload.get("speech_final"))

            if transcript:
                logger.info(f"📝 Transcript ({'FINAL' if is_final else 'interim'}): '{transcript}'")
                if self.on_transcript:
                    self.on_transcript(transcript, is_final)
                if self.on_result:
                    self.on_result(transcript, is_final, confidence)
        elif msg_type == "SpeechStarted":
            logger.info("🗣️ Deepgram speech started")
            if self.on_speech_started:
                self.on_speech_started()
        elif msg_type == "UtteranceEnd":
            last_word_end = payload.get("last_word_end")
            logger.info("⏹️ Deepgram utterance ended")
            if self.on_utterance_end:
                self.on_utterance_end(last_word_end)
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

