"""
Edge TTS (neural voices via Microsoft Edge).

Uses edge-tts package; output is MP3 bytes for base64 transport.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncGenerator

import edge_tts

from utils.logger import get_logger

logger = get_logger("EdgeTTSService")


@dataclass(frozen=True)
class EdgeTTSConfig:
    voice: str = "en-US-JennyNeural"
    rate: str = "+0%"  # e.g. "+10%", "-10%"
    pitch: str = "+0Hz"  # e.g. "+2Hz", "-2Hz"


class EdgeTTSService:
    """Text-to-Speech using Edge neural voices."""

    def __init__(self, voice: str = "en-US-JennyNeural", rate: str = "+0%", pitch: str = "+0Hz"):
        self._cfg = EdgeTTSConfig(voice=voice, rate=rate, pitch=pitch)
        logger.info(
            f"✅ Edge TTS initialized with voice={self._cfg.voice} rate={self._cfg.rate} pitch={self._cfg.pitch}"
        )

    @property
    def content_type(self) -> str:
        return "audio/mpeg"

    async def text_to_speech(self, text: str) -> bytes:
        """Convert text to MP3 bytes."""
        clean = (text or "").strip()
        if not clean:
            logger.warning("Empty text provided for Edge TTS")
            return b""

        try:
            logger.info(f"🗣️ [EdgeTTS] Generating speech: {clean[:60]}...")

            communicate = edge_tts.Communicate(
                text=clean,
                voice=self._cfg.voice,
                rate=self._cfg.rate,
                pitch=self._cfg.pitch,
            )

            audio = bytearray()
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio" and chunk.get("data"):
                    audio.extend(chunk["data"])

            audio_bytes = bytes(audio)
            logger.info(f"✅ [EdgeTTS] Generated {len(audio_bytes)} bytes")
            return audio_bytes

        except Exception as e:
            logger.error(f"❌ [EdgeTTS] TTS generation error: {e}", exc_info=True)
            return b""

    async def text_to_speech_stream(self, text: str) -> AsyncGenerator[bytes, None]:
        """Yield MP3 chunks as soon as Edge TTS produces them."""
        clean = (text or "").strip()
        if not clean:
            logger.warning("Empty text provided for Edge TTS stream")
            return

        try:
            logger.info(f"🗣️ [EdgeTTS] Streaming speech: {clean[:60]}...")
            communicate = edge_tts.Communicate(
                text=clean,
                voice=self._cfg.voice,
                rate=self._cfg.rate,
                pitch=self._cfg.pitch,
            )

            async for chunk in communicate.stream():
                if chunk.get("type") == "audio" and chunk.get("data"):
                    yield chunk["data"]
        except Exception as e:
            logger.error(f"❌ [EdgeTTS] Streaming error: {e}", exc_info=True)

