"""backend/services/edge_tts_service.py

Edge TTS Service (free-ish neural voices via Microsoft Edge)

Why this exists:
- ElevenLabs quota can be hit quickly.
- Edge neural voices are high quality and often work without an API key.

Notes:
- This relies on the `edge-tts` Python package.
- Output is MP3 bytes suitable for base64 transport to the frontend.
"""

from __future__ import annotations

from dataclasses import dataclass

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
