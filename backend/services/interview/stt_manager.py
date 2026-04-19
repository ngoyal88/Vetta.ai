"""Deepgram STT connection lifecycle and transcript dispatch for LiveKit interviews."""
import asyncio
from typing import Any, Callable, Optional

from utils.logger import get_logger
from services.interview.livekit_transport import LiveKitTransport

logger = get_logger("STTManager")

OnTranscriptFn = Callable[[str, bool], None]


class STTManager:
    def __init__(
        self,
        deepgram_service_class: Any,
        settings: Any,
        transport: LiveKitTransport,
        on_transcript_fn: OnTranscriptFn,
    ) -> None:
        self._DeepgramSTTService = deepgram_service_class
        self._settings = settings
        self._transport = transport
        self._on_transcript_fn = on_transcript_fn
        self._stt_service: Optional[Any] = None
        self._reconnect_lock = asyncio.Lock()

    async def connect(self) -> bool:
        self._stt_service = self._DeepgramSTTService(on_transcript=self._handle_transcript)
        return await self._stt_service.connect()

    async def close(self) -> None:
        if self._stt_service:
            await self._stt_service.close()
        self._stt_service = None

    @property
    def is_connected(self) -> bool:
        return self._stt_service is not None and self._stt_service.is_connected

    async def reconnect(self) -> None:
        async with self._reconnect_lock:
            if self._stt_service and self._stt_service.is_connected:
                return
            if self._stt_service:
                await self._stt_service.close()
            self._stt_service = self._DeepgramSTTService(on_transcript=self._handle_transcript)
            if await self._stt_service.connect():
                await self._transport.send_status("reconnecting_stt")
                logger.info("Deepgram reconnected")
            else:
                await self._transport.send_error("Speech service reconnection failed")

    def _handle_transcript(self, text: str, is_final: bool) -> None:
        logger.info("Deepgram transcript: %s (final=%s)", text, is_final)
        asyncio.create_task(self._dispatch_transcript(text, is_final))

    async def _dispatch_transcript(self, text: str, is_final: bool) -> None:
        await self._transport.send_transcript(text, is_final)
        self._on_transcript_fn(text, is_final)

    async def send_audio(self, data: bytes) -> None:
        if not self._stt_service or not self._stt_service.is_connected:
            await self.reconnect()
        if self._stt_service and self._stt_service.is_connected:
            await self._stt_service.send_audio(data)
