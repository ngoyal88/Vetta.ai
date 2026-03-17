"""Edge TTS plugin for LiveKit Agents (livekit-agents v1.4+).

Fetches complete MP3 audio from Microsoft Edge TTS, decodes it to
24 kHz mono signed-16 PCM, and pushes it through the AudioEmitter API.
"""
from __future__ import annotations

import io
import time
from typing import Any, List

import av
import edge_tts
from livekit.agents import APIConnectOptions, DEFAULT_API_CONNECT_OPTIONS, tts


def _mp3_to_pcm(mp3_bytes: bytes) -> bytes:
    """Decode a complete MP3 buffer to 24 kHz mono signed-16 PCM.

    Uses explicit sample-count slicing on each plane to avoid picking up
    alignment padding that PyAV may append, which would manifest as crackling.
    """
    buf = io.BytesIO(mp3_bytes)
    container = av.open(buf, format="mp3")
    resampler = av.AudioResampler(format="s16", layout="mono", rate=24000)
    parts: List[bytes] = []

    for frame in container.decode(audio=0):
        for resampled in resampler.resample(frame):
            parts.append(bytes(resampled.planes[0])[: resampled.samples * 2])

    for resampled in resampler.resample(None):
        parts.append(bytes(resampled.planes[0])[: resampled.samples * 2])

    return b"".join(parts)


class EdgeTTSPlugin(tts.TTS):
    """LiveKit Agents-compatible wrapper around Microsoft Edge TTS."""

    def __init__(self, voice: str, rate: str = "+0%", pitch: str = "+0Hz") -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self.voice = voice
        self.rate = rate
        self.pitch = pitch

    def synthesize(
        self,
        text: str,
        *,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
    ) -> tts.ChunkedStream:
        return _EdgeChunkedStream(tts_plugin=self, input_text=text, conn_options=conn_options)

    async def _fetch_mp3(self, text: str) -> bytes:
        """Stream MP3 audio from the Edge TTS service and return complete bytes."""
        communicate = edge_tts.Communicate(
            text=text,
            voice=self.voice,
            rate=self.rate,
            pitch=self.pitch,
        )
        mp3_data = bytearray()
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                data = chunk.get("data") or b""
                if data:
                    mp3_data.extend(data)
        return bytes(mp3_data)


class _EdgeChunkedStream(tts.ChunkedStream):
    def __init__(
        self,
        *,
        tts_plugin: EdgeTTSPlugin,
        input_text: str,
        conn_options: APIConnectOptions,
    ) -> None:
        super().__init__(tts=tts_plugin, input_text=input_text, conn_options=conn_options)
        self.tts_plugin = tts_plugin

    async def _run(self, output_emitter: Any) -> None:
        output_emitter.initialize(
            request_id=f"edge-{int(time.time() * 1000)}",
            sample_rate=24000,
            num_channels=1,
            mime_type="audio/pcm",
            frame_size_ms=20,
        )

        mp3_bytes = await self.tts_plugin._fetch_mp3(self._input_text)
        if mp3_bytes:
            pcm = _mp3_to_pcm(mp3_bytes)
            if pcm:
                output_emitter.push(pcm)

        output_emitter.flush()
