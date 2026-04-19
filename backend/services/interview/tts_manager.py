"""Text-to-speech orchestration: response dict → audio → LiveKit transport."""
import asyncio
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from utils.logger import get_logger
from services.interview.livekit_transport import LiveKitTransport

logger = get_logger("TTSManager")

OnPhaseChangeFn = Callable[[str], Awaitable[None]]


class TTSManager:
    def __init__(self, tts_service: Any, tts_cache: Any, transport: LiveKitTransport) -> None:
        self._tts_service = tts_service
        self._tts_cache = tts_cache
        self._transport = transport
        self.speech_lock = asyncio.Lock()
        self.is_ai_speaking = False

    def clear_cache(self) -> None:
        self._tts_cache.clear()

    def _extract_speakable_text(self, response: Any) -> str:
        if isinstance(response, str):
            return response
        if isinstance(response, dict):
            if response.get("type") == "coding":
                q = response.get("question")
                coding_question = q if isinstance(q, dict) else response
                return (
                    f"{coding_question.get('title', '')}. "
                    f"{coding_question.get('description', '')[:200]}..."
                )
            q = response.get("question")
            if isinstance(q, dict):
                return q.get("question", "")
            if isinstance(q, str):
                return q
        return str(response)

    async def speak_response(self, response: Any, on_phase_change_fn: OnPhaseChangeFn) -> None:
        async with self.speech_lock:
            try:
                self.is_ai_speaking = True
                speak_text = self._extract_speakable_text(response)
                phase = self._transport._get_phase()
                if isinstance(response, dict) and response.get("type") == "coding":
                    if phase != "dsa":
                        await on_phase_change_fn("dsa")
                elif phase == "dsa":
                    await on_phase_change_fn("behavioral")

                if not speak_text:
                    return
                cached = self._tts_cache.get(speak_text)
                if cached:
                    audio_data = cached
                else:
                    await self._transport.send_status("speaking")
                    audio_data = await self._tts_service.text_to_speech(speak_text)
                    if audio_data:
                        self._tts_cache.put(speak_text, audio_data)
                if not audio_data:
                    inner = self._transport._get_dsa_inner_question(response) or response
                    await self._transport.send_message({
                        "type": "question", "question": inner, "phase": self._transport._get_phase(),
                        "audio": None, "spoken_text": speak_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    await self._transport.send_error("TTS failed")
                    return
                await self._transport.send_question(response, audio_data, speak_text)
            except Exception as e:
                logger.error("TTS error: %s", e, exc_info=True)
                await self._transport.send_error("Failed to generate speech")
            finally:
                self.is_ai_speaking = False
