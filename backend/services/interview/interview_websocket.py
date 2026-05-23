# DEPRECATED: Manual WebSocket interview handler (STT/LLM/TTS in FastAPI).
# Superseded by services/interview/agent.py (livekit-agents AgentSession pipeline).
# The /ws/interview endpoint is no longer the active code path. Can be deleted.
"""
WebSocket handler for real-time interview (audio, STT, TTS, LLM).
"""
import asyncio
import base64
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from config import get_settings
from services.integrations import DeepgramSTTService, EdgeTTSService, TTSCache
from services.interview.interview_service import InterviewService
from services.interview.session_engine import InterviewSessionEngine
from utils.logger import get_logger

logger = get_logger("InterviewWebSocket")
settings = get_settings()


class InterviewWebSocketHandler:
    """Handles interview flow over WebSocket."""

    def __init__(self, websocket: WebSocket, session_id: str, user_id: Optional[str] = None):
        self.websocket = websocket
        self.session_id = session_id
        self.session_key = f"interview:{session_id}"
        self.user_id = user_id

        self.stt_service: Optional[DeepgramSTTService] = None
        tts_provider = (getattr(settings, "tts_provider", "edge") or "edge").strip().lower()
        if tts_provider == "elevenlabs":
            self.tts_service = EdgeTTSService(
                voice=getattr(settings, "edge_tts_voice", "en-US-JennyNeural"),
                rate=getattr(settings, "edge_tts_rate", "+0%"),
                pitch=getattr(settings, "edge_tts_pitch", "+0Hz"),
            )
        else:
            self.tts_service = EdgeTTSService(
                voice=getattr(settings, "edge_tts_voice", "en-US-JennyNeural"),
                rate=getattr(settings, "edge_tts_rate", "+0%"),
                pitch=getattr(settings, "edge_tts_pitch", "+0Hz"),
            )
        self.interview_service = InterviewService()
        self.tts_cache = TTSCache()
        self.engine: Optional[InterviewSessionEngine] = None

        self.is_ai_speaking = False
        self.speech_lock = asyncio.Lock()

        self.last_activity = datetime.now(timezone.utc)
        self.heartbeat_task = None
        self.audio_chunks_received = 0

        logger.info(f"✅ WebSocket handler initialized for session: {session_id}")

    @property
    def connected(self) -> bool:
        return (
            self.websocket.client_state != WebSocketState.DISCONNECTED
            and self.websocket.application_state != WebSocketState.DISCONNECTED
        )

    async def after_answer_processed(self) -> None:
        await self.send_status("listening")

    async def handle_connection(self):
        """Main connection handler"""
        try:
            await self.websocket.accept()
            logger.info(f"✅ WebSocket connected: {self.session_id}")

            if not settings.deepgram_api_key:
                await self.send_error("Speech service not configured")
                await self.websocket.close(code=1011)
                return

            self.engine = InterviewSessionEngine(
                self.session_id,
                self.user_id or "",
                self,
                self.interview_service,
                settings,
            )

            logger.info("🎤 Initializing Deepgram STT...")
            self.stt_service = DeepgramSTTService(
                on_transcript=lambda *_: None,
                on_result=self._on_stt_result,
                on_utterance_end=self._on_utterance_end,
            )

            if not await self.stt_service.connect():
                await self.send_error("Failed to connect to speech service")
                return

            await self.engine.initialize()

            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())

            await self._message_loop()

        except WebSocketDisconnect:
            logger.info(f"🔌 Client disconnected: {self.session_id}")
        except Exception as e:
            logger.error(f"❌ WebSocket error: {e}", exc_info=True)
            await self.send_error(str(e))
        finally:
            await self.cleanup()

    def _on_stt_result(self, text: str, is_final: bool, confidence: Optional[float]) -> None:
        if self.engine:
            asyncio.create_task(self.engine.on_transcript(text, is_final, confidence))

    def _on_utterance_end(self, last_word_end: Optional[int]) -> None:
        if self.engine:
            asyncio.create_task(self.engine.on_utterance_end(last_word_end))

    async def _message_loop(self):
        """Listen for and process client messages"""
        while True:
            if self.websocket.client_state == WebSocketState.DISCONNECTED or self.websocket.application_state == WebSocketState.DISCONNECTED:
                logger.info(f"WebSocket disconnected, stopping receive loop: {self.session_id}")
                break
            try:
                data = await asyncio.wait_for(self.websocket.receive(), timeout=60.0)
                self.last_activity = datetime.now(timezone.utc)
                text_payload = data.get("text")
                bytes_payload = data.get("bytes")

                if text_payload is not None:
                    try:
                        message = json.loads(text_payload)
                    except Exception:
                        logger.warning("⚠️ Received non-JSON text payload")
                        continue
                    await self._handle_message(message)

                elif bytes_payload is not None:
                    await self._handle_audio(bytes_payload)

            except asyncio.TimeoutError:
                logger.warning(f"⏰ Receive timeout for {self.session_id}")
                continue
            except WebSocketDisconnect:
                break
            except RuntimeError as e:
                if 'Cannot call "receive" once a disconnect' in str(e):
                    logger.info(f"Disconnect frame received; stopping loop: {self.session_id}")
                    break
                logger.error(f"Runtime error in receive: {e}")
                break
            except Exception as e:
                logger.error(f"❌ Message error: {e}", exc_info=True)

    async def _handle_message(self, message: Dict[str, Any]):
        """Handle text messages"""
        msg_type = message.get("type")
        logger.info(f"📨 Received message: {msg_type}")
        eng = self.engine

        if msg_type == "start_recording":
            await self.send_status("listening")
            logger.info("🎤 Client started recording")

        elif msg_type == "stop_recording":
            await self.send_status("processing")
            logger.info("🛑 Client stopped recording")

        elif msg_type == "ai_playback_ended":
            async with self.speech_lock:
                self.is_ai_speaking = False
            await self.send_status("listening")
            logger.info("🔇 Client reported AI playback ended; resuming mic")

        elif msg_type == "answer_complete":
            logger.info("✅ Client marked answer complete")
            if eng:
                await eng.finalize_answer()

        elif msg_type == "interrupt":
            await self._handle_interruption()

        elif msg_type == "skip_question":
            if eng:
                await eng.on_skip_question()

        elif msg_type == "end_interview":
            if eng:
                await eng.on_end_interview(completion_reason="user_ended")

        elif msg_type == "candidate_away":
            if eng:
                await eng.on_candidate_away()

        elif msg_type == "candidate_back":
            if eng:
                await eng.on_candidate_back()

        elif msg_type == "ping":
            await self.send_message({"type": "pong"})

        elif msg_type == "dsa_next_question":
            if eng:
                await eng.on_dsa_next_question()

        elif msg_type == "code_update":
            if eng:
                raw_code = message.get("code") or ""
                await eng.on_code_update(
                    raw_code,
                    str(message.get("language") or "python"),
                    float(message.get("changed_at") or time.time()),
                )

        elif msg_type == "execution_result":
            if eng:
                await eng.on_execution_result(
                    str(message.get("output") or ""),
                    bool(message.get("has_errors")),
                )

        elif msg_type == "text_answer":
            if eng:
                await eng.on_text_answer(str(message.get("text") or ""))

    async def _handle_audio(self, audio_bytes: bytes):
        """Process incoming audio; echo prevention when AI is speaking."""
        self.audio_chunks_received += 1

        if self.audio_chunks_received % 10 == 0:
            logger.info(
                f"🎵 Received {self.audio_chunks_received} audio chunks ({len(audio_bytes)} bytes) "
                f"ai_speaking={self.is_ai_speaking}"
            )

        if self.is_ai_speaking:
            logger.debug("⏸️ Ignoring audio - AI speaking (echo prevention)")
            return

        if self.stt_service:
            try:
                await self.stt_service.send_audio(audio_bytes)
            except Exception as e:
                logger.error(f"❌ Error sending audio to STT: {e}")
        else:
            logger.warning("⚠️ STT service not initialized")

    async def _handle_interruption(self) -> None:
        logger.info("🛑 User interrupted AI")
        async with self.speech_lock:
            self.is_ai_speaking = False
        await self.send_status("listening")
        await self.send_message({"type": "interrupted"})

    def _get_dsa_inner_question(self, payload: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None
        if payload.get("type") == "coding" and isinstance(payload.get("question"), dict):
            return payload["question"]
        if isinstance(payload.get("title"), str) and "test_cases" in payload:
            return payload
        return None

    async def speak(self, text: str, question_metadata: Dict[str, Any]) -> None:
        """ITransport: TTS + question message."""
        response: Any = question_metadata.get("response", question_metadata.get("text"))
        if response is None:
            response = text
        async with self.speech_lock:
            try:
                self.is_ai_speaking = True
                speak_text = text.strip() if text else ""

                if not speak_text:
                    logger.warning("⚠️ No speakable text")
                    self.is_ai_speaking = False
                    return

                logger.info(f"🗣️ Speaking: {speak_text[:100]}...")
                cached_audio = self.tts_cache.get(speak_text)
                if cached_audio:
                    logger.info("📦 Using cached audio")
                    audio_data = cached_audio
                else:
                    await self.send_status("speaking")
                    audio_data = await self.tts_service.text_to_speech(speak_text)
                    if audio_data:
                        self.tts_cache.put(speak_text, audio_data)
                        logger.info(f"✅ Generated {len(audio_data)} bytes of audio")

                if not audio_data:
                    inner = self._get_dsa_inner_question(response) or response
                    await self.send_message(
                        {
                            "type": "question",
                            "question": inner,
                            "phase": self.engine.current_phase if self.engine else "behavioral",
                            "audio": None,
                            "spoken_text": speak_text,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                    await self.send_error("TTS failed: no audio generated")
                    self.is_ai_speaking = False
                    return

                await self.send_question(response, audio_data, speak_text)

            except Exception as e:
                logger.error(f"❌ TTS error: {e}", exc_info=True)
                await self.send_error("Failed to generate speech")
                self.is_ai_speaking = False

    async def send_question(
        self,
        question: Dict[str, Any],
        audio: Optional[bytes],
        spoken_text: Optional[str] = None,
        stream_id: Optional[str] = None,
    ):
        """Send question (with or without audio)."""
        inner = self._get_dsa_inner_question(question) or question
        message: Dict[str, Any] = {
            "type": "question",
            "question": inner,
            "phase": self.engine.current_phase if self.engine else "greeting",
            "spoken_text": spoken_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if stream_id:
            message["stream_id"] = stream_id
        if audio:
            message["audio"] = base64.b64encode(audio).decode("utf-8")
            message["audio_content_type"] = "audio/mpeg"
        else:
            message["audio"] = None
        await self.send_message(message)
        logger.info("📤 Sent question" + (" with audio" if audio else " (no audio)"))

    async def send_transcript(self, text: str, is_final: bool):
        """Send transcript"""
        message = {
            "type": "transcript",
            "text": text,
            "is_final": is_final,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.send_message(message)

    async def send_status(self, status: str):
        """Send status"""
        message = {
            "type": "status",
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.send_message(message)
        logger.debug(f"📊 Status: {status}")

    async def send_error(self, error_message: str):
        """Send error"""
        message = {
            "type": "error",
            "message": error_message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.send_message(message)
        logger.error(f"❌ Sent error: {error_message}")

    async def send_message(self, message: Dict[str, Any]):
        """Send message"""
        try:
            if self.websocket.client_state == WebSocketState.DISCONNECTED or self.websocket.application_state == WebSocketState.DISCONNECTED:
                return
            await self.websocket.send_json(message)
        except Exception as e:
            logger.error(f"❌ Failed to send message: {e}")

    async def _heartbeat_loop(self):
        """Send periodic heartbeats"""
        try:
            while True:
                await asyncio.sleep(30)
                await self.send_message({"type": "heartbeat"})
        except asyncio.CancelledError:
            pass

    async def cleanup(self):
        """Cleanup"""
        logger.info(f"🧹 Cleaning up session: {self.session_id}")

        if self.heartbeat_task:
            self.heartbeat_task.cancel()

        if self.engine:
            await self.engine.cleanup()

        if self.stt_service:
            await self.stt_service.close()

        self.tts_cache.clear()

        logger.info(f"✅ Cleanup complete. Received {self.audio_chunks_received} audio chunks total")
