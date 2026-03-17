# DEPRECATED: Pre-agent bot-as-participant LiveKit handler.
# Superseded by services/interview/agent.py (livekit-agents AgentSession pipeline).
# This file is not loaded when USE_AGENT_WORKER_V2=true and can be deleted.
"""
LiveKit room handler: bot joins as participant, same interview state machine as WebSocket.
All AI (STT, LLM, TTS) stays in FastAPI; LiveKit is transport only.
"""
import asyncio
import base64
import json
import re
import time
import uuid
from contextlib import suppress
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncGenerator, Dict, Optional

from config import get_settings
from firebase_admin import firestore
from firebase_config import db
from services.interview.session_conductor import SessionConductor
from utils.feedback_parser import parse_scores_from_feedback
from utils.logger import get_logger
from utils.redis_client import get_session, update_session, redis as redis_client

logger = get_logger("LiveKitRoomHandler")
settings = get_settings()
SESSION_TTL = getattr(settings, "interview_session_ttl_seconds", 7200)
CONTROL_PAYLOAD_MAX = 14000
AUDIO_CHUNK_PAYLOAD_MAX = 12000
CODE_PAYLOAD_MAX_LENGTH = 100_000


class InterviewPhase(str, Enum):
    GREETING = "greeting"
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    DSA_CODING = "dsa"
    WRAP_UP = "wrap_up"
    FEEDBACK = "feedback"
    ENDED = "ended"


class RuntimeState(str, Enum):
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"


def _mint_bot_token(session_id: str) -> str:
    from datetime import timedelta
    from livekit import api as lk_api

    token = lk_api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
    token = token.with_identity(f"interview-bot-{session_id}").with_grants(
        lk_api.VideoGrants(room_join=True, room=session_id)
    ).with_ttl(timedelta(hours=4))
    return token.to_jwt()


class InterviewLiveKitHandler:
    """Same interview logic as InterviewWebSocketHandler; transport is LiveKit data channel."""

    def __init__(self, session_id: str, user_id: str, room: Any, prewarm: bool = False):
        self.session_id = session_id
        self.user_id = user_id
        self.room = room
        self.session_key = f"interview:{session_id}"
        self._prewarm = prewarm
        self._greeting_audio_cache: Optional[bytes] = None
        self._greeting_text_cache: Optional[str] = None
        self._candidate_joined: Optional[asyncio.Event] = asyncio.Event() if prewarm else None

        from services.integrations import (
            DeepgramSTTService,
            EdgeTTSService,
            ElevenLabsTTSService,
            TTSCache,
        )
        from services.interview.interview_service import InterviewService
        from models.interview import DifficultyLevel

        self._DeepgramSTTService = DeepgramSTTService
        self._InterviewService = InterviewService
        self._DifficultyLevel = DifficultyLevel

        tts_provider = (getattr(settings, "tts_provider", "edge") or "edge").strip().lower()
        if tts_provider == "elevenlabs" and getattr(settings, "elevenlabs_api_key", None):
            self.tts_service = ElevenLabsTTSService()
        else:
            self.tts_service = EdgeTTSService(
                voice=getattr(settings, "edge_tts_voice", "en-US-JennyNeural"),
                rate=getattr(settings, "edge_tts_rate", "+0%"),
                pitch=getattr(settings, "edge_tts_pitch", "+0Hz"),
            )
        self.interview_service = self._InterviewService()
        self.tts_cache = TTSCache()
        self.conductor = SessionConductor()

        self.stt_service: Optional[DeepgramSTTService] = None
        self.current_phase = InterviewPhase.GREETING
        self.runtime_state = RuntimeState.LISTENING
        self.is_processing = False
        self.is_ai_speaking = False
        self.current_transcript = []
        self.current_answer_parts = []
        self.latest_interim_transcript: str = ""
        self.current_code: str = ""
        self.previous_code: str = ""
        self.current_language: str = "python"
        self.last_execution_output: Optional[str] = None
        self.code_has_errors: bool = False
        self.last_code_change_at: float = 0.0
        self._last_transcript_confidence: Optional[float] = None
        self._first_question: Optional[Dict[str, Any]] = None
        self._session_started_at: Optional[datetime] = None
        self.processing_lock = asyncio.Lock()
        self.speech_lock = asyncio.Lock()
        self.stt_reconnect_lock = asyncio.Lock()
        self.audio_chunks_received = 0
        self.audio_chunks_forwarded = 0
        self.audio_chunks_suppressed = 0
        self.heartbeat_task: Optional[asyncio.Task] = None
        self._disconnect_future: Optional[asyncio.Future] = None
        self._disconnect_task: Optional[asyncio.Task] = None
        self._room_connected = True
        self._waiting_for_finalize = False
        self._finalize_timeout_task: Optional[asyncio.Task] = None
        self._speech_end_confirm_task: Optional[asyncio.Task] = None
        self._silence_watchdog_task: Optional[asyncio.Task] = None
        self._last_speech_activity = time.monotonic()
        self._last_warning_sent_at = 0.0
        self._silence_tier_sent = 0
        self._tab_is_backgrounded = False
        self._session_paused = False
        self._tts_cancel_event = asyncio.Event()
        self._tts_task: Optional[asyncio.Task] = None
        self._current_tts_stream_id: Optional[str] = None
        self._current_tts_writer: Optional[Any] = None
        self._current_answer_started_at: Optional[float] = None
        self._last_ai_audio_ended_at: float = 0.0
        self._prebuild_context_task: Optional[asyncio.Task] = None
        self._prebuilt_context: Optional[str] = None
        self._audio_started_sent: bool = False
        self._streaming_tts_enabled = bool(getattr(settings, "streaming_tts_enabled", True))
        self._speaking_ended_at: Optional[float] = None
        self._streaming_llm_enabled = bool(getattr(settings, "streaming_llm_enabled", True))
        self._tts_transport = (getattr(settings, "livekit_tts_transport", "bytes") or "bytes").strip().lower()
        self._silence_warning_seconds = float(getattr(settings, "deepgram_silence_warning_seconds", 5))
        self._auto_process_silence_seconds = float(getattr(settings, "deepgram_auto_process_silence_seconds", 8))
        self._waiting_for_speech_seconds = float(getattr(settings, "deepgram_waiting_for_speech_seconds", 15))

        logger.info("LiveKit handler initialized for session %s", session_id)

    async def _send_message(self, message: Dict[str, Any]) -> None:
        if not self._room_connected or not self.room or not self.room.local_participant:
            return
        try:
            payload = json.dumps(message).encode("utf-8")
            if len(payload) <= CONTROL_PAYLOAD_MAX:
                await self.room.local_participant.publish_data(
                    payload, reliable=True, topic="control"
                )
            else:
                await self._send_chunked_question(message, payload)
        except Exception as e:
            logger.error("Failed to send message: %s", e, exc_info=True)

    async def _send_chunked_question(self, message: Dict[str, Any], raw_payload: bytes) -> None:
        """Send question with large audio as chunked: header on control + audio_chunk messages."""
        if message.get("type") != "question" or "audio" not in message:
            logger.warning("Chunking only supported for question with audio; truncating")
            await self.room.local_participant.publish_data(
                raw_payload[:CONTROL_PAYLOAD_MAX], reliable=True, topic="control"
            )
            return
        question_id = str(uuid.uuid4())
        audio_b64 = message.get("audio") or ""
        total_chunks = (
            (len(audio_b64) + AUDIO_CHUNK_PAYLOAD_MAX - 1) // AUDIO_CHUNK_PAYLOAD_MAX
            if audio_b64
            else 0
        )
        header = {
            "type": "question_chunked",
            "question_id": question_id,
            "total_chunks": total_chunks,
            "question": message.get("question"),
            "phase": message.get("phase"),
            "spoken_text": message.get("spoken_text"),
            "timestamp": message.get("timestamp"),
        }
        header_msg = json.dumps(header).encode("utf-8")
        await self.room.local_participant.publish_data(header_msg, reliable=True, topic="control")

        for idx, i in enumerate(range(0, len(audio_b64), AUDIO_CHUNK_PAYLOAD_MAX)):
            chunk_data = audio_b64[i : i + AUDIO_CHUNK_PAYLOAD_MAX]
            chunk_msg = json.dumps(
                {
                    "question_id": question_id,
                    "chunk_index": idx,
                    "total_chunks": total_chunks,
                    "data": chunk_data,
                }
            ).encode("utf-8")
            await self.room.local_participant.publish_data(
                chunk_msg, reliable=True, topic="audio_chunk"
            )

    async def send_message(self, message: Dict[str, Any]) -> None:
        await self._send_message(message)

    async def send_transcript(self, text: str, is_final: bool) -> None:
        await self.send_message(
            {
                "type": "transcript",
                "text": text,
                "is_final": is_final,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    async def send_status(self, status: str) -> None:
        await self.send_message(
            {
                "type": "status",
                "status": status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    async def send_error(self, error_message: str) -> None:
        await self.send_message(
            {
                "type": "error",
                "message": error_message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    async def send_question(
        self,
        question: Dict[str, Any],
        audio: Optional[bytes],
        spoken_text: Optional[str] = None,
        stream_id: Optional[str] = None,
    ) -> None:
        inner = self._get_dsa_inner_question(question) or question
        message = {
            "type": "question",
            "question": inner,
            "phase": self.current_phase.value,
            "spoken_text": spoken_text,
            "stream_id": stream_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if audio:
            message["audio"] = base64.b64encode(audio).decode("utf-8")
            message["audio_content_type"] = "audio/mpeg"
        else:
            message["audio"] = None
        await self._send_message(message)
        logger.info("Sent question" + (" with audio" if audio else " (no audio)"))

    def _set_runtime_state(self, state: RuntimeState) -> None:
        if state == RuntimeState.SPEAKING:
            self._speaking_ended_at = None
        elif state == RuntimeState.LISTENING and self.runtime_state == RuntimeState.SPEAKING:
            self._speaking_ended_at = time.time()
        self.runtime_state = state
        self.is_processing = state == RuntimeState.PROCESSING
        self.is_ai_speaking = state == RuntimeState.SPEAKING

    def _post_speech_cooldown(self) -> bool:
        """True if we are within 500ms after the bot stopped speaking (do not send mic to STT)."""
        if self._speaking_ended_at is None:
            return False
        return (time.time() - self._speaking_ended_at) < 0.5

    def _get_dsa_inner_question(self, payload: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None
        if payload.get("type") == "coding" and isinstance(payload.get("question"), dict):
            return payload["question"]
        if isinstance(payload.get("title"), str) and "test_cases" in payload:
            return payload
        return None

    def _is_dsa_session(self, session_data: Dict[str, Any]) -> bool:
        it = session_data.get("interview_type") or ""
        return str(it).lower() == "dsa"

    def _extract_speakable_text(self, response: Dict[str, Any]) -> str:
        if isinstance(response, str):
            return response
        if isinstance(response, dict):
            if response.get("type") == "coding":
                return f"{response.get('title', '')}. {response.get('description', '')[:200]}..."
            q = response.get("question")
            if isinstance(q, dict):
                return q.get("question", "")
            if isinstance(q, str):
                return q
        return str(response)

    def _should_flush_segment(self, text: str, is_first_segment: bool) -> bool:
        clean = (text or "").strip()
        if not clean:
            return False

        sentence_end = bool(re.search(r"[.!?]\s*$", clean))
        clause_end = bool(re.search(r"[,;:\-]\s*$", clean))

        if is_first_segment:
            return (
                (sentence_end and len(clean) > 15)
                or (clause_end and len(clean) > 100)
                or len(clean) > 150
            )

        return (
            (sentence_end and len(clean) > 60)
            or (clause_end and len(clean) > 120)
            or len(clean) > 200
        )

    def _set_conductor_phase(self, phase: InterviewPhase) -> None:
        self.conductor.session_phase = "dsa" if phase == InterviewPhase.DSA_CODING else phase.value

    def _build_current_answer_text(self) -> str:
        parts = list(self.current_answer_parts)
        interim = (self.latest_interim_transcript or "").strip()
        if interim:
            parts.append(interim)
        return " ".join([part for part in parts if part]).strip()

    async def _persist_conductor_state(self, session_data: Optional[Dict[str, Any]] = None) -> None:
        snapshot = session_data if session_data is not None else await get_session(self.session_key)
        if not snapshot:
            return
        snapshot["session_conductor"] = self.conductor.serialize()
        await update_session(self.session_key, snapshot, expire_seconds=SESSION_TTL)

    async def _emergency_save_session(self) -> None:
        """Save session and conductor state on candidate disconnect; swallow exceptions."""
        try:
            snapshot = await get_session(self.session_key)
            if not snapshot:
                return
            snapshot["session_conductor"] = self.conductor.serialize()
            snapshot["emergency_checkpoint_at"] = datetime.now(timezone.utc).isoformat()
            await update_session(self.session_key, snapshot, expire_seconds=SESSION_TTL)
            try:
                last_turns = (snapshot.get("responses") or [])[-5:]
                db.collection("interviews").document(self.session_id).set({
                    "responses": last_turns,
                    "session_conductor": snapshot.get("session_conductor"),
                    "emergency_checkpoint_at": firestore.SERVER_TIMESTAMP,
                }, merge=True)
            except Exception as fe:
                logger.warning("Emergency Firestore merge failed: %s", fe)
        except Exception as e:
            logger.warning("Emergency save failed: %s", e)

    async def _prebuild_llm_context(self) -> str:
        self._prebuilt_context = self.conductor.build_llm_context()
        return self._prebuilt_context

    async def _ensure_prebuilt_context(self) -> Optional[str]:
        if self._prebuild_context_task and not self._prebuild_context_task.done():
            with suppress(asyncio.CancelledError):
                self._prebuilt_context = await self._prebuild_context_task
        elif self._prebuilt_context is None:
            self._prebuilt_context = await self._prebuild_llm_context()
        return self._prebuilt_context

    async def _run_confirm_sleep(self, delay_seconds: float = 0.3) -> None:
        await asyncio.sleep(delay_seconds)

    async def _send_audio_started(self) -> None:
        if self._audio_started_sent:
            return
        self._audio_started_sent = True
        await self.send_message({"type": "audio_started"})

    async def _send_audio_ended(self) -> None:
        await self.send_message({"type": "audio_ended"})

    def _choose_backchannel_tone(self) -> str:
        if self.conductor.last_recommended_action in {"CHALLENGE", "ADVANCE"}:
            return "positive"
        if self.conductor.last_recommended_action in {"PROBE", "SIMPLIFY", "HINT"}:
            return "probe"
        return "neutral"

    async def _produce_followup_stream(self, prepared: Dict[str, Any], queue: "asyncio.Queue[Optional[str]]") -> None:
        try:
            async for chunk in self.interview_service.generate_follow_up_stream(
                prepared["responses"],
                prepared["interview_type"],
                llm_context=prepared.get("llm_context", ""),
            ):
                await queue.put(chunk)
        finally:
            await queue.put(None)

    async def on_data(self, data_packet: Any) -> None:
        data = getattr(data_packet, "data", data_packet) if not isinstance(data_packet, bytes) else data_packet
        topic = getattr(data_packet, "topic", None) if not isinstance(data_packet, bytes) else None

        try:
            length = len(data) if isinstance(data, (bytes, bytearray)) else "non-bytes"
        except Exception:
            length = "unknown"
        logger.info("LiveKit DataReceived: topic=%s len=%s", topic, length)

        if topic == "audio":
            self.audio_chunks_received += 1
            if self.runtime_state == RuntimeState.SPEAKING:
                return
            if self._post_speech_cooldown():
                return
            if self.stt_service:
                try:
                    if not self.stt_service.is_connected:
                        await self._reconnect_stt()
                    if self.stt_service.is_connected:
                        self.audio_chunks_forwarded += 1
                        await self.stt_service.send_audio(data if isinstance(data, bytes) else bytes(data))
                except Exception as e:
                    logger.error("STT send_audio error: %s", e, exc_info=True)
                    asyncio.create_task(self._reconnect_stt())
            return

        try:
            text = data.decode("utf-8") if isinstance(data, bytes) else str(data)
            message = json.loads(text)
        except Exception:
            if topic in (None, "", "control"):
                logger.warning("Dropping malformed control payload (topic=%s)", topic, exc_info=True)
            return
        await self._handle_message(message)

    async def _reconnect_stt(self) -> None:
        async with self.stt_reconnect_lock:
            if self.stt_service and self.stt_service.is_connected:
                return
            if self.stt_service:
                await self.stt_service.close()
            self.stt_service = self._DeepgramSTTService(
                on_transcript=lambda _text, _is_final: None,
                on_result=self._on_transcript_received,
                on_speech_started=self._on_speech_started,
                on_utterance_end=self._on_utterance_end,
            )
            if await self.stt_service.connect():
                await self.send_status("reconnecting_stt")
                logger.info("Deepgram reconnected")
            else:
                await self.send_error("Speech service reconnection failed")

    def _on_transcript_received(
        self,
        text: str,
        is_final: bool,
        confidence: Optional[float] = None,
    ) -> None:
        logger.info("Deepgram transcript: %s (final=%s)", text, is_final)
        asyncio.create_task(self._process_transcript(text, is_final, confidence))

    def _on_speech_started(self) -> None:
        self._last_speech_activity = time.monotonic()
        if self._speech_end_confirm_task and not self._speech_end_confirm_task.done():
            self._speech_end_confirm_task.cancel()
        if self._prebuild_context_task and not self._prebuild_context_task.done():
            self._prebuild_context_task.cancel()
        self._prebuilt_context = None
        self._current_answer_started_at = self._current_answer_started_at or time.monotonic()
        if self._last_ai_audio_ended_at:
            self.conductor.pause_before_last_response = max(
                0.0, (time.monotonic() - self._last_ai_audio_ended_at) * 1000
            )

    def _on_utterance_end(self, _last_word_end: Optional[int]) -> None:
        if self.current_phase == InterviewPhase.GREETING:
            return
        if self._speech_end_confirm_task and not self._speech_end_confirm_task.done():
            self._speech_end_confirm_task.cancel()
        asyncio.create_task(self.send_message({"type": "interviewer_thinking"}))
        self._prebuild_context_task = asyncio.create_task(self._prebuild_llm_context())
        self._speech_end_confirm_task = asyncio.create_task(self._confirm_utterance_end())

    async def _confirm_utterance_end(self) -> None:
        if self.current_phase == InterviewPhase.GREETING:
            return
        try:
            await asyncio.gather(
                self._run_confirm_sleep(0.15),
                self._ensure_prebuilt_context(),
            )
            if (
                self.runtime_state == RuntimeState.LISTENING
                and not self.processing_lock.locked()
                and not self._waiting_for_finalize
                and (self.current_answer_parts or self.latest_interim_transcript.strip())
            ):
                await self.send_message(
                    {
                        "type": "utterance_end_detected",
                        "transcript": " ".join(self.current_answer_parts).strip(),
                    }
                )
                await self._finalize_current_answer()
        except asyncio.CancelledError:
            pass

    async def _process_transcript(
        self,
        text: str,
        is_final: bool,
        confidence: Optional[float] = None,
    ) -> None:
        self._last_speech_activity = time.monotonic()
        await self.send_transcript(text, is_final)
        if not is_final:
            self.latest_interim_transcript = text
            self.current_transcript.append(text)
            self.conductor.latest_interim_transcript = text
            return

        final_segment = text.strip()
        if final_segment:
            self.current_answer_parts.append(final_segment)
            self.conductor.current_answer_parts.append(final_segment)
        self.latest_interim_transcript = ""
        self.conductor.latest_interim_transcript = ""
        self.current_transcript.clear()
        self._last_transcript_confidence = confidence

        if self._waiting_for_finalize:
            self._waiting_for_finalize = False
            if self._finalize_timeout_task and not self._finalize_timeout_task.done():
                self._finalize_timeout_task.cancel()
            await self._finalize_current_answer()

    async def _start_finalize_timeout(self) -> None:
        try:
            await asyncio.sleep(3)
            if self._waiting_for_finalize:
                self._waiting_for_finalize = False
                await self._finalize_current_answer()
        except asyncio.CancelledError:
            pass

    async def _silence_watchdog_loop(self) -> None:
        """Three-tier silence: 30s / 60s / 120s. Skip when not LISTENING, GREETING, or tab/session paused."""
        try:
            while self._room_connected:
                await asyncio.sleep(5)
                if self.runtime_state != RuntimeState.LISTENING:
                    continue
                if self.current_phase == InterviewPhase.GREETING:
                    continue
                if getattr(self, "_tab_is_backgrounded", False) or getattr(self, "_session_paused", False):
                    continue

                silence_for = time.monotonic() - self._last_speech_activity
                if silence_for < 30:
                    self._silence_tier_sent = 0
                tier_sent = getattr(self, "_silence_tier_sent", 0)

                if tier_sent >= 3:
                    continue

                if silence_for >= 120 and tier_sent < 3:
                    self._silence_tier_sent = 3
                    await self.send_message({"type": "silence_warning", "tier": 3, "seconds_silent": 120})
                    await self._speak_response("We're having technical difficulties. You can type your answer in the text box, or we can try again in a moment.")
                    continue
                if silence_for >= 60 and tier_sent < 2:
                    self._silence_tier_sent = 2
                    await self.send_message({"type": "silence_warning", "tier": 2, "seconds_silent": 60})
                    await self._speak_response("Would you like me to rephrase the question?")
                    continue
                if silence_for >= 30 and tier_sent < 1:
                    self._silence_tier_sent = 1
                    await self.send_message({"type": "silence_warning", "tier": 1, "seconds_silent": 30})
                    await self._speak_response("Take your time. When you're ready, just start speaking.")

                if (
                    silence_for >= self._auto_process_silence_seconds
                    and not self.processing_lock.locked()
                    and not self._waiting_for_finalize
                    and (self.current_answer_parts or (self.latest_interim_transcript or "").strip())
                ):
                    self._silence_tier_sent = 0
                    await self._finalize_current_answer()
                    continue

                if (
                    silence_for >= self._waiting_for_speech_seconds
                    and not self.current_answer_parts
                    and not (self.latest_interim_transcript or "").strip()
                ):
                    await self.send_status("waiting_for_speech")
        except asyncio.CancelledError:
            pass

    async def _handle_message(self, message: Dict[str, Any]) -> None:
        msg_type = message.get("type")
        if msg_type == "start_recording":
            self._last_speech_activity = time.monotonic()
            self._set_runtime_state(RuntimeState.LISTENING)
            await self.send_status("listening")
        elif msg_type == "stop_recording":
            self._set_runtime_state(RuntimeState.PROCESSING)
            await self.send_status("processing")
        elif msg_type == "speech_started":
            self._last_speech_activity = time.monotonic()
            if self._speech_end_confirm_task and not self._speech_end_confirm_task.done():
                self._speech_end_confirm_task.cancel()
        elif msg_type == "speech_ended":
            if self.current_phase == InterviewPhase.GREETING:
                return
            self._last_speech_activity = time.monotonic()
        elif msg_type == "hint_done_speaking":
            if self.current_phase == InterviewPhase.GREETING:
                logger.debug("Ignoring hint_done_speaking during greeting")
                return
            asyncio.create_task(self.send_message({"type": "interviewer_thinking"}))
            self._prebuild_context_task = asyncio.create_task(self._prebuild_llm_context())
            if not self.stt_service:
                await self._finalize_current_answer()
                return
            self._waiting_for_finalize = True
            await self.stt_service.finalize()
            if self._finalize_timeout_task and not self._finalize_timeout_task.done():
                self._finalize_timeout_task.cancel()
            self._finalize_timeout_task = asyncio.create_task(self._start_finalize_timeout())
        elif msg_type == "answer_complete":
            if self.current_phase == InterviewPhase.GREETING:
                logger.debug("Ignoring answer_complete during greeting")
                return
            asyncio.create_task(self.send_message({"type": "interviewer_thinking"}))
            self._prebuild_context_task = asyncio.create_task(self._prebuild_llm_context())
            await self._finalize_current_answer()
        elif msg_type == "ai_playback_ended":
            self._last_ai_audio_ended_at = time.monotonic()
            self._set_runtime_state(RuntimeState.LISTENING)
            await self.send_status("listening")
        elif msg_type in ("interrupt", "user_speech_during_ai"):
            await self._handle_interruption()
        elif msg_type == "skip_question":
            await self._handle_skip_question()
        elif msg_type == "end_interview":
            await self._end_interview()
        elif msg_type == "ping":
            await self.send_message({"type": "pong"})
        elif msg_type == "paste_detected":
            self.conductor.large_paste_occurred = True
        elif msg_type == "text_answer":
            text = str(message.get("text") or "").strip()
            if len(text) < 3:
                await self.send_error("Please enter at least 3 characters.")
                return
            self.current_answer_parts = [text]
            self.conductor.current_answer_parts = [text]
            self.latest_interim_transcript = ""
            self.current_transcript.clear()
            self.conductor.latest_interim_transcript = ""
            await self._finalize_current_answer()
        elif msg_type == "dsa_next_question":
            await self._handle_dsa_next_question()
        elif msg_type == "code_update":
            raw_code = message.get("code") or ""
            if len(raw_code) > CODE_PAYLOAD_MAX_LENGTH:
                await self.send_error("Code is too long.")
                return
            self.previous_code = self.current_code
            self.current_code = raw_code
            self.current_language = message.get("language") or "python"
            self.last_code_change_at = time.time()
            self.conductor.update_code(
                self.current_code,
                language=self.current_language,
                changed_at=self.last_code_change_at,
            )
            await self._persist_conductor_state()
        elif msg_type == "execution_result":
            self.last_execution_output = message.get("output") or ""
            self.code_has_errors = bool(message.get("has_errors"))
            self.conductor.update_execution(
                self.last_execution_output,
                self.code_has_errors,
            )
            await self._persist_conductor_state()

    async def _handle_interruption(self) -> None:
        interrupted_stream_id = self._current_tts_stream_id
        self._set_runtime_state(RuntimeState.INTERRUPTED)
        await self._cancel_active_tts("interrupt")
        self.current_transcript.clear()
        self.latest_interim_transcript = ""
        self.conductor.latest_interim_transcript = ""
        await self.send_status("interrupted")
        await self.send_message(
            {
                "type": "interrupt_ack",
                "stream_id": interrupted_stream_id,
                "transcript_so_far": " ".join(self.current_answer_parts).strip(),
            }
        )
        self._set_runtime_state(RuntimeState.LISTENING)
        await self.send_status("listening")

    async def _cancel_active_tts(self, reason: str) -> None:
        self._tts_cancel_event.set()
        if self._tts_task and not self._tts_task.done():
            self._tts_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._tts_task
        if self._current_tts_writer:
            with suppress(Exception):
                await self._current_tts_writer.aclose(reason=reason)
            self._current_tts_writer = None
        if self._current_tts_stream_id:
            await self.send_message(
                {
                    "type": "tts_stream_cancelled",
                    "stream_id": self._current_tts_stream_id,
                    "reason": reason,
                }
            )
        self._current_tts_stream_id = None
        self._set_runtime_state(RuntimeState.LISTENING)

    async def _open_tts_output(self, stream_id: str) -> Dict[str, Any]:
        if self._tts_transport == "bytes" and hasattr(self.room.local_participant, "stream_bytes"):
            writer = await self.room.local_participant.stream_bytes(
                "tts-response.mp3",
                topic="tts",
                mime_type="audio/mpeg",
                attributes={"stream_id": stream_id},
                stream_id=stream_id,
            )
            self._current_tts_writer = writer
            return {"transport": "bytes", "writer": writer}
        return {"transport": "packets", "chunk_index": 0}

    async def _write_tts_chunk(self, output: Dict[str, Any], stream_id: str, chunk: bytes) -> None:
        if output["transport"] == "bytes":
            await output["writer"].write(chunk)
            return

        await self.send_message(
            {
                "type": "tts_chunk",
                "stream_id": stream_id,
                "chunk_index": output["chunk_index"],
                "data": base64.b64encode(chunk).decode("utf-8"),
                "is_last": False,
            }
        )
        output["chunk_index"] += 1

    async def _close_tts_output(
        self,
        output: Dict[str, Any],
        stream_id: str,
        cancelled: bool = False,
        reason: str = "completed",
    ) -> None:
        if output["transport"] == "bytes":
            with suppress(Exception):
                await output["writer"].aclose(reason=reason)
            self._current_tts_writer = None
            if cancelled:
                await self.send_message(
                    {
                        "type": "tts_stream_cancelled",
                        "stream_id": stream_id,
                        "reason": reason,
                    }
                )
            else:
                await self._send_audio_ended()
            return

        if cancelled:
            await self.send_message(
                {
                    "type": "tts_stream_cancelled",
                    "stream_id": stream_id,
                    "reason": reason,
                }
            )
        else:
            await self.send_message({"type": "tts_stream_end", "stream_id": stream_id})
            await self._send_audio_ended()

    async def _iter_tts_audio_chunks(self, text: str) -> AsyncGenerator[bytes, None]:
        clean = (text or "").strip()
        if not clean:
            return

        cached = self.tts_cache.get(clean)
        if cached:
            for i in range(0, len(cached), 4096):
                chunk = cached[i : i + 4096]
                yield chunk
            return

        if hasattr(self.tts_service, "text_to_speech_stream"):
            cached_bytes = bytearray()
            async for chunk in self.tts_service.text_to_speech_stream(clean):
                if not chunk:
                    continue
                cached_bytes.extend(chunk)
                yield chunk
            if cached_bytes:
                self.tts_cache.put(clean, bytes(cached_bytes))
            return

        audio_data = await self.tts_service.text_to_speech(clean)
        if audio_data:
            self.tts_cache.put(clean, audio_data)
            for i in range(0, len(audio_data), 4096):
                yield audio_data[i : i + 4096]

    async def _stream_audio_for_text(
        self,
        stream_id: str,
        output: Dict[str, Any],
        text: str,
    ) -> bool:
        wrote_audio = False
        async for chunk in self._iter_tts_audio_chunks(text):
            if self._tts_cancel_event.is_set():
                break
            if not wrote_audio:
                await self._send_audio_started()
            await self._write_tts_chunk(output, stream_id, chunk)
            wrote_audio = True
        return wrote_audio

    async def _send_tts_stream_start(
        self,
        stream_id: str,
        response: Any,
        spoken_text: Optional[str],
    ) -> None:
        await self.send_message(
            {
                "type": "tts_stream_start",
                "stream_id": stream_id,
                "question": self._get_dsa_inner_question(response) or response,
                "phase": self.current_phase.value,
                "spoken_text": spoken_text,
                "transport": self._tts_transport,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    async def _speak_response(self, response: Dict[str, Any]) -> None:
        async with self.speech_lock:
            try:
                speak_text = self._extract_speakable_text(response)
                if isinstance(response, dict) and response.get("type") == "coding":
                    if self.current_phase != InterviewPhase.DSA_CODING:
                        await self.send_message({"type": "phase_change", "phase": "dsa"})
                    self.current_phase = InterviewPhase.DSA_CODING
                    self._set_conductor_phase(self.current_phase)
                elif self.current_phase == InterviewPhase.DSA_CODING:
                    self.current_phase = InterviewPhase.BEHAVIORAL
                    self._set_conductor_phase(self.current_phase)
                    await self.send_message({"type": "phase_change", "phase": "behavioral"})

                if not speak_text:
                    self._set_runtime_state(RuntimeState.LISTENING)
                    return

                if not self._streaming_tts_enabled:
                    cached = self.tts_cache.get(speak_text)
                    if cached:
                        audio_data = cached
                    else:
                        self._set_runtime_state(RuntimeState.SPEAKING)
                        await self.send_status("speaking")
                        audio_data = await self.tts_service.text_to_speech(speak_text)
                        if audio_data:
                            self.tts_cache.put(speak_text, audio_data)
                    if not audio_data:
                        await self.send_question(response, None, speak_text)
                        await self.send_error("TTS failed")
                        self._set_runtime_state(RuntimeState.LISTENING)
                        return
                    await self.send_question(response, audio_data, speak_text)
                    self.conductor.append_turn("interviewer", speak_text)
                    asyncio.create_task(self._persist_conductor_state())
                    self._set_runtime_state(RuntimeState.SPEAKING)
                    return

                stream_id = str(uuid.uuid4())
                self._current_tts_stream_id = stream_id
                self._tts_cancel_event = asyncio.Event()
                self._audio_started_sent = False
                self._set_runtime_state(RuntimeState.SPEAKING)
                await self.send_status("speaking")
                await self._send_tts_stream_start(stream_id, response, speak_text)
                output = await self._open_tts_output(stream_id)

                wrote_audio = await self._stream_audio_for_text(stream_id, output, speak_text)
                cancelled = self._tts_cancel_event.is_set()
                await self._close_tts_output(
                    output,
                    stream_id,
                    cancelled=cancelled,
                    reason="interrupt" if cancelled else "completed",
                )
                if not wrote_audio and not cancelled:
                    await self.send_question(response, None, speak_text, stream_id=stream_id)
                    await self.send_error("TTS failed")
                    self._set_runtime_state(RuntimeState.LISTENING)
                else:
                    self.conductor.append_turn("interviewer", speak_text)
                    asyncio.create_task(self._persist_conductor_state())
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("TTS error: %s", e, exc_info=True)
                await self.send_error("Failed to generate speech")
                self._set_runtime_state(RuntimeState.LISTENING)

    async def _stream_followup_response(self, prepared: Dict[str, Any]) -> None:
        async with self.speech_lock:
            stream_id = str(uuid.uuid4())
            self._current_tts_stream_id = stream_id
            self._tts_cancel_event = asyncio.Event()
            self._audio_started_sent = False
            self._set_runtime_state(RuntimeState.SPEAKING)
            await self.send_status("speaking")
            await self._send_tts_stream_start(
                stream_id,
                {"question": None, "type": prepared["interview_type"].value},
                None,
            )
            output = await self._open_tts_output(stream_id)
            full_text = ""
            segment_buffer = ""
            wrote_audio = False
            is_first_segment = True
            queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
            producer_task = asyncio.create_task(self._produce_followup_stream(prepared, queue))

            backchannel = (prepared.get("backchannel") or "").strip()
            if backchannel:
                wrote_audio = await self._stream_audio_for_text(stream_id, output, backchannel) or wrote_audio

            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                if self._tts_cancel_event.is_set():
                    break
                full_text += chunk
                segment_buffer += chunk
                if self._should_flush_segment(segment_buffer, is_first_segment):
                    wrote_audio = (
                        await self._stream_audio_for_text(stream_id, output, segment_buffer) or wrote_audio
                    )
                    segment_buffer = ""
                    is_first_segment = False

            if self._tts_cancel_event.is_set() and not producer_task.done():
                producer_task.cancel()
            with suppress(asyncio.CancelledError):
                await producer_task

            if segment_buffer and not self._tts_cancel_event.is_set():
                wrote_audio = (
                    await self._stream_audio_for_text(stream_id, output, segment_buffer) or wrote_audio
                )

            cancelled = self._tts_cancel_event.is_set()
            await self._close_tts_output(
                output,
                stream_id,
                cancelled=cancelled,
                reason="interrupt" if cancelled else "completed",
            )
            if cancelled:
                self._set_runtime_state(RuntimeState.LISTENING)
                return

            final_text = re.sub(r"\s+", " ", full_text).strip()
            if not final_text:
                await self.send_error("Failed to generate follow-up question")
                self._set_runtime_state(RuntimeState.LISTENING)
                return

            prepared["session_data"]["session_conductor"] = self.conductor.serialize()
            next_question_obj = await self.interview_service.persist_followup_question(prepared, final_text)
            if not wrote_audio:
                await self.send_error("Streaming TTS produced no audio")
            self.conductor.append_turn("interviewer", final_text)
            await self._persist_conductor_state(prepared["session_data"])
            await self.send_question(next_question_obj, None, final_text, stream_id=stream_id)

    async def _finalize_current_answer(self) -> None:
        complete_text = self._build_current_answer_text()

        self.current_answer_parts.clear()
        self.latest_interim_transcript = ""
        self.current_transcript.clear()
        self.conductor.current_answer_parts.clear()
        self.conductor.latest_interim_transcript = ""

        if not complete_text or len(complete_text) < 3:
            await self.send_status("waiting_for_speech")
            await self.send_error("No answer captured yet. Please speak a bit more.")
            return
        if len(complete_text) > 10_000:
            await self.send_error("Answer is too long. Please summarize.")
            return
        if self.processing_lock.locked():
            return
        if self._last_transcript_confidence is not None and self._last_transcript_confidence < 0.4 and len(complete_text) < 10:
            await self.send_error("We didn't quite catch that. Could you repeat?")
            return

        answer_duration = 0.0
        if self._current_answer_started_at is not None:
            answer_duration = max(0.0, time.monotonic() - self._current_answer_started_at)
        self._current_answer_started_at = None
        self.conductor.last_answer_duration = answer_duration
        self.conductor.turn_count += 1
        self.conductor.append_turn("candidate", complete_text)

        async with self.processing_lock:
            self._set_runtime_state(RuntimeState.PROCESSING)
            try:
                max_duration_min = getattr(settings, "max_interview_duration_minutes", 60)
                if self._session_started_at and max_duration_min > 0:
                    elapsed = (datetime.now(timezone.utc) - self._session_started_at).total_seconds() / 60
                    if elapsed >= max_duration_min:
                        await self._end_interview()
                        return

                if self.current_phase == InterviewPhase.GREETING:
                    await self.send_status("thinking")
                    session_data = await get_session(self.session_key)
                    if session_data:
                        session_data["candidate_intro"] = complete_text
                        await update_session(self.session_key, session_data, expire_seconds=SESSION_TTL)
                    first_question = self._first_question or (
                        session_data and (session_data.get("questions") or [])[0]
                        if session_data.get("questions")
                        else None
                    )
                    if not first_question:
                        await self.send_error("No questions available")
                        return
                    self.current_phase = InterviewPhase.BEHAVIORAL
                    self._set_conductor_phase(self.current_phase)
                    await self._persist_conductor_state(session_data)
                    await self._speak_response(first_question)
                    return

                await self.send_status("thinking")

                if self._streaming_llm_enabled:
                    prepared = await self.interview_service.prepare_followup(self.session_id, complete_text)
                    if prepared.get("done"):
                        await self._speak_response(prepared["response"])
                        return
                    current_question = prepared.get("current_question", {})
                    if isinstance(current_question, dict):
                        question_payload = current_question.get("question", current_question)
                        if isinstance(question_payload, dict):
                            question_text = question_payload.get("question") or question_payload.get("title") or ""
                        else:
                            question_text = str(question_payload)
                    else:
                        question_text = str(current_question)
                    evaluation = await self.interview_service.evaluate_answer(
                        question_text,
                        complete_text,
                        answer_duration,
                        self.conductor.current_code,
                    )
                    self.conductor.update_from_answer(complete_text, evaluation)
                    prepared["llm_context"] = (
                        f"{self._prebuilt_context or self.conductor.build_llm_context()}\n"
                        f"LATEST ANSWER EVALUATION:\n"
                        f"- Quality: {evaluation.get('quality')}\n"
                        f"- Completeness: {evaluation.get('completeness')}\n"
                        f"- What was good: {evaluation.get('what_was_good')}\n"
                        f"- What was missing: {evaluation.get('what_was_missing')}\n"
                        f"- Detected misconception: {evaluation.get('detected_misconception')}\n"
                        f"- Confidence signal: {evaluation.get('confidence_signal')}\n"
                        f"- Recommended action: {evaluation.get('recommended_action')}\n"
                    )
                    prepared["evaluation"] = evaluation
                    prepared["backchannel"] = self.conductor.get_backchannel(self._choose_backchannel_tone())
                    prepared["session_data"]["session_conductor"] = self.conductor.serialize()
                    await asyncio.wait_for(self._stream_followup_response(prepared), timeout=45.0)
                    self._prebuilt_context = None
                    return

                response = await asyncio.wait_for(
                    self.interview_service.process_answer_and_generate_followup(
                        self.session_id,
                        complete_text,
                        llm_context=self._prebuilt_context or self.conductor.build_llm_context(),
                    ),
                    timeout=30.0,
                )

                await self._speak_response(response)
            except asyncio.TimeoutError:
                await self.send_error("Processing timeout")
            except Exception as e:
                logger.error("Processing error: %s", e, exc_info=True)
                await self.send_error("Failed to process answer")
            finally:
                self._prebuilt_context = None
                if self.runtime_state != RuntimeState.SPEAKING:
                    self._set_runtime_state(RuntimeState.LISTENING)
                    await self.send_status("listening")

    async def _handle_dsa_next_question(self) -> None:
        from models.interview import InterviewType
        session_data = await get_session(self.session_key)
        if not session_data:
            await self.send_error("Session not found")
            return
        questions = session_data.get("questions", []) or []
        current_q_index = int(session_data.get("current_question_index", 0))
        try:
            difficulty = self._DifficultyLevel(session_data.get("difficulty", "medium"))
        except Exception:
            difficulty = self._DifficultyLevel.MEDIUM
        context = self.interview_service._build_context(
            InterviewType.DSA, session_data.get("resume_data"),
            session_data.get("custom_role"), session_data.get("years_experience"),
        )
        next_question_raw = await self.interview_service._generate_dsa_question(difficulty, context)
        next_question_obj = {"question": next_question_raw, "type": "coding", "timestamp": datetime.now(timezone.utc).isoformat()}
        questions.append(next_question_obj)
        session_data["questions"] = questions
        session_data["current_question_index"] = current_q_index + 1
        session_data["last_updated"] = datetime.now(timezone.utc).isoformat()
        session_data["session_conductor"] = self.conductor.serialize()
        await update_session(self.session_key, session_data, expire_seconds=SESSION_TTL)
        self.current_phase = InterviewPhase.DSA_CODING
        self._set_conductor_phase(self.current_phase)
        self.conductor.append_turn("interviewer", self._extract_speakable_text(next_question_raw))
        await self.send_message({"type": "phase_change", "phase": "dsa"})
        await self.send_message({
            "type": "question", "question": next_question_raw, "phase": "dsa",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        asyncio.create_task(self._persist_conductor_state())

    async def _handle_skip_question(self) -> None:
        from models.interview import InterviewType
        session_data = await get_session(self.session_key)
        if not session_data:
            await self.send_error("Session not found")
            return
        questions = session_data.get("questions", []) or []
        current_q_index = int(session_data.get("current_question_index", 0))
        try:
            interview_type = InterviewType(session_data.get("interview_type", "dsa"))
        except Exception:
            interview_type = InterviewType.DSA
        try:
            difficulty = self._DifficultyLevel(session_data.get("difficulty", "medium"))
        except Exception:
            difficulty = self._DifficultyLevel.MEDIUM
        responses = session_data.get("responses", []) or []
        skipped = questions[current_q_index] if current_q_index < len(questions) else None
        if skipped:
            responses.append({"question_index": current_q_index, "question": skipped, "response": "[skipped by user]", "skipped": True, "timestamp": datetime.now(timezone.utc).isoformat()})
        if interview_type == InterviewType.DSA:
            context = self.interview_service._build_context(InterviewType.DSA, session_data.get("resume_data"), session_data.get("custom_role"), session_data.get("years_experience"))
            next_question_raw = await self.interview_service._generate_dsa_question(difficulty, context)
            next_question_obj = {"question": next_question_raw, "type": "coding", "timestamp": datetime.now(timezone.utc).isoformat()}
        else:
            follow_up_text = await self.interview_service.generate_follow_up(responses, interview_type)
            next_question_obj = {"question": {"question": follow_up_text}, "type": interview_type.value, "timestamp": datetime.now(timezone.utc).isoformat()}
        questions.append(next_question_obj)
        session_data["questions"] = questions
        session_data["responses"] = responses
        session_data["current_question_index"] = current_q_index + 1
        session_data["last_updated"] = datetime.now(timezone.utc).isoformat()
        session_data["session_conductor"] = self.conductor.serialize()
        await update_session(self.session_key, session_data, expire_seconds=SESSION_TTL)
        if next_question_obj.get("type") == "coding":
            self.current_phase = InterviewPhase.DSA_CODING
            self._set_conductor_phase(self.current_phase)
            self.conductor.append_turn("interviewer", self._extract_speakable_text(next_question_obj))
            await self.send_message({"type": "phase_change", "phase": "dsa"})
            inner = self._get_dsa_inner_question(next_question_obj) or next_question_obj
            await self.send_message({"type": "question", "question": inner, "phase": "dsa", "audio": None, "spoken_text": None, "timestamp": datetime.now(timezone.utc).isoformat()})
            asyncio.create_task(self._persist_conductor_state())
        else:
            await self._speak_response(next_question_obj)

    async def _on_participant_disconnected(self, participant: Any) -> None:
        """Called when candidate leaves; emergency save then start 90s grace period."""
        await self._emergency_save_session()
        self._disconnect_task = asyncio.create_task(self._handle_candidate_disconnect())

    async def _handle_candidate_disconnect(self) -> None:
        """Wait 90s then mark session incomplete and optionally generate partial feedback."""
        try:
            await asyncio.sleep(90)
        except asyncio.CancelledError:
            logger.info("Candidate reconnected, cancelling disconnect flow for session %s", self.session_id)
            return
        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                if self._disconnect_future and not self._disconnect_future.done():
                    self._disconnect_future.set_result(None)
                return
            session_data["status"] = "incomplete_exit"
            session_data["completion_reason"] = "candidate_disconnected"
            completed_ts = datetime.now(timezone.utc).isoformat()
            session_data["completed_at"] = completed_ts
            session_data["last_updated"] = completed_ts
            turn_count = len(session_data.get("responses", []))
            if turn_count >= 2:
                try:
                    started_at_raw = session_data.get("started_at")
                    started_at = None
                    if isinstance(started_at_raw, str):
                        try:
                            started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
                        except Exception:
                            pass
                    elif isinstance(started_at_raw, datetime):
                        started_at = started_at_raw
                    if not started_at:
                        started_at = datetime.now(timezone.utc)
                    duration_minutes = int(max(0, (datetime.now(timezone.utc) - started_at).total_seconds() / 60))
                    feedback_payload = {
                        "interview_type": session_data.get("interview_type"),
                        "custom_role": session_data.get("custom_role"),
                        "duration": duration_minutes,
                        "responses": session_data.get("responses", []),
                        "code_submissions": session_data.get("code_submissions", []),
                    }
                    final_feedback = await asyncio.wait_for(
                        self.interview_service.generate_final_feedback(feedback_payload),
                        45.0,
                    )
                    session_data["final_feedback"] = final_feedback
                except (asyncio.TimeoutError, Exception) as e:
                    logger.warning("Partial feedback generation failed: %s", e)
            session_data["questions_answered"] = len(session_data.get("responses", []))
            session_data["code_problems_attempted"] = len(session_data.get("code_submissions", []))
            await update_session(self.session_key, session_data, expire_seconds=SESSION_TTL)
            try:
                scores = parse_scores_from_feedback(
                    session_data.get("final_feedback", {}).get("feedback") if isinstance(session_data.get("final_feedback"), dict) else None
                )
                db.collection("interviews").document(self.session_id).set({
                    "status": "incomplete_exit",
                    "completion_reason": "candidate_disconnected",
                    "completed_at": firestore.SERVER_TIMESTAMP,
                    "last_updated": firestore.SERVER_TIMESTAMP,
                    "questions_answered": session_data["questions_answered"],
                    "code_problems_attempted": session_data["code_problems_attempted"],
                    "responses": session_data.get("responses", []),
                    "questions": session_data.get("questions", []),
                    "code_submissions": session_data.get("code_submissions", []),
                    "final_feedback": session_data.get("final_feedback"),
                    "scores": scores,
                }, merge=True)
            except Exception as fe:
                logger.warning("Firestore persist on disconnect failed: %s", fe)
        finally:
            if self._disconnect_future and not self._disconnect_future.done():
                self._disconnect_future.set_result(None)

    async def _on_participant_reconnected(self, participant: Any) -> None:
        """Restore session and conductor when candidate rejoins."""
        session_data = await get_session(self.session_key)
        if session_data:
            self.conductor = SessionConductor.load(session_data.get("session_conductor"))
        await self.send_status("reconnected")
        await self._speak_response("Welcome back. Ready to continue where we left off?")

    async def _end_interview(self) -> None:
        if self.current_phase == InterviewPhase.ENDED:
            return
        feedback_lock_key = f"feedback_generating:{self.session_id}"
        try:
            acquired = await redis_client.set(feedback_lock_key, "1", nx=True, ex=120)
        except Exception as e:
            logger.warning("Could not acquire feedback lock: %s", e)
            acquired = False
        if not acquired:
            logger.info("Feedback already being generated for session %s, skipping", self.session_id)
            return
        self.current_phase = InterviewPhase.FEEDBACK
        self._set_conductor_phase(self.current_phase)
        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                await self.send_error("Session not found")
                return
            started_at_raw = session_data.get("started_at")
            started_at = None
            if isinstance(started_at_raw, str):
                try:
                    started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
                except Exception:
                    pass
            elif isinstance(started_at_raw, datetime):
                started_at = started_at_raw
            if not started_at:
                started_at = datetime.now(timezone.utc)
            duration_minutes = int(max(0, (datetime.now(timezone.utc) - started_at).total_seconds() / 60))
            feedback_payload = {
                "interview_type": session_data.get("interview_type"),
                "custom_role": session_data.get("custom_role"),
                "duration": duration_minutes,
                "responses": session_data.get("responses", []),
                "code_submissions": session_data.get("code_submissions", []),
            }
            final_feedback = await self.interview_service.generate_final_feedback(feedback_payload)
            scores = parse_scores_from_feedback(final_feedback.get("feedback") if isinstance(final_feedback, dict) else None)
            completed_ts = datetime.now(timezone.utc).isoformat()
            session_data["status"] = "ended_early"
            session_data["completion_reason"] = "ended_early"
            session_data["completed_at"] = completed_ts
            session_data["last_updated"] = completed_ts
            session_data["final_feedback"] = final_feedback
            session_data["duration_minutes"] = duration_minutes
            session_data["questions_answered"] = len(session_data.get("responses", []))
            session_data["code_problems_attempted"] = len(session_data.get("code_submissions", []))
            await update_session(self.session_key, session_data, expire_seconds=SESSION_TTL)
            try:
                db.collection("interviews").document(self.session_id).set({
                    "status": "ended_early", "completion_reason": "ended_early",
                    "completed_at": firestore.SERVER_TIMESTAMP, "last_updated": firestore.SERVER_TIMESTAMP,
                    "duration_minutes": duration_minutes, "questions_answered": session_data["questions_answered"],
                    "code_problems_attempted": session_data["code_problems_attempted"],
                    "responses": session_data.get("responses", []), "questions": session_data.get("questions", []),
                    "code_submissions": session_data.get("code_submissions", []), "final_feedback": final_feedback,
                    "scores": scores,
                }, merge=True)
            except Exception as fe:
                logger.warning("Firestore persist failed: %s", fe)
            await self.send_message({
                "type": "feedback",
                "feedback": final_feedback.get("feedback") if isinstance(final_feedback, dict) else final_feedback,
                "full": final_feedback, "duration_minutes": duration_minutes,
                "questions_answered": session_data["questions_answered"],
                "code_problems_attempted": session_data["code_problems_attempted"],
                "status": "ended_early", "timestamp": completed_ts,
            })
            await self.send_status("completed")
        except Exception as e:
            logger.error("Error ending interview: %s", e, exc_info=True)
            await self.send_error("Failed to finalize interview")
        finally:
            self._set_runtime_state(RuntimeState.LISTENING)
            self.current_phase = InterviewPhase.ENDED
            self._set_conductor_phase(self.current_phase)

    async def _heartbeat_loop(self) -> None:
        try:
            while self._room_connected:
                await asyncio.sleep(15)
                await self.send_message({"type": "heartbeat", "ts": time.time(), "session_id": self.session_id})
        except asyncio.CancelledError:
            pass

    async def initialize(self) -> None:
        from services.integrations import DeepgramSTTService
        session_data = await get_session(self.session_key)
        if not session_data:
            await self.send_error("Session not found")
            return
        started_at_raw = session_data.get("started_at")
        self.conductor = SessionConductor.load(session_data.get("session_conductor"))
        self.current_code = self.conductor.current_code
        self.previous_code = self.conductor.previous_code
        self.current_language = self.conductor.current_language
        self.last_execution_output = self.conductor.last_execution_output
        self.code_has_errors = self.conductor.code_has_errors
        self.last_code_change_at = self.conductor.last_code_change_at
        if isinstance(started_at_raw, str):
            try:
                self._session_started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
            except Exception:
                self._session_started_at = datetime.now(timezone.utc)
        else:
            self._session_started_at = datetime.now(timezone.utc)
        if self._session_started_at:
            self.conductor.session_start_time = self._session_started_at.timestamp()

        if not settings.deepgram_api_key:
            await self.send_error("Speech service not configured")
            return

        self.stt_service = DeepgramSTTService(
            on_transcript=lambda _text, _is_final: None,
            on_result=self._on_transcript_received,
            on_speech_started=self._on_speech_started,
            on_utterance_end=self._on_utterance_end,
        )

        async def _on_stt_reconnect_status(status: str, attempt: int) -> None:
            await self.send_message({"type": status, "attempt": attempt})

        self.stt_service.register_reconnect_callback(_on_stt_reconnect_status)
        connected = await self.stt_service.connect()
        if not connected:
            # Don't fail the whole interview; start greeting and let STT reconnect in background.
            await self.send_status("reconnecting_stt")
            asyncio.create_task(self._reconnect_stt())
        await self.send_status("connected")
        if self._prewarm:
            asyncio.create_task(self._prewarm_greeting())
            await self._candidate_joined.wait()
            await self._play_prewarmed_greeting()
        else:
            await self._start_greeting(session_data)
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self._silence_watchdog_task = asyncio.create_task(self._silence_watchdog_loop())

    async def _prewarm_greeting(self) -> None:
        """Pre-generate greeting text and TTS; cache for playback when candidate joins."""
        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                return
            user_name = session_data.get("candidate_name") or (
                ((session_data.get("resume_data") or {}).get("name") or {}).get("raw")
                if isinstance(session_data.get("resume_data"), dict)
                else session_data.get("user_id", "Candidate")
            )
            role = session_data.get("custom_role") or session_data.get("interview_type", "technical")
            greeting_text = await self.interview_service.generate_greeting(user_name, role)
            audio_data = await self.tts_service.text_to_speech(greeting_text)
            if audio_data:
                self.tts_cache.put(greeting_text, audio_data)
            self._greeting_text_cache = greeting_text
        except Exception as e:
            logger.warning("Prewarm greeting failed: %s", e, exc_info=True)
            self._greeting_text_cache = None

    async def _play_prewarmed_greeting(self) -> None:
        """Play cached greeting (or fall back to _start_greeting if cache missing)."""
        session_data = await get_session(self.session_key)
        if not session_data:
            await self.send_error("Session not found")
            return
        questions = session_data.get("questions", []) or []
        first_question = questions[0] if questions else None
        if not first_question:
            await self.send_error("No questions available")
            return
        self._first_question = first_question
        if self._greeting_text_cache:
            self.current_phase = InterviewPhase.GREETING
            self._set_conductor_phase(self.current_phase)
            await self._speak_response(self._greeting_text_cache)
        else:
            await self._start_greeting(session_data)

    async def _start_greeting(self, session_data: Dict[str, Any]) -> None:
        questions = session_data.get("questions", []) or []
        first_question = questions[0] if questions else None
        if not first_question:
            await self.send_error("No questions available")
            return
        if self._is_dsa_session(session_data):
            inner = self._get_dsa_inner_question(first_question) or first_question
            test_cases = inner.get("test_cases") if isinstance(inner, dict) else []
            if not test_cases or not isinstance(test_cases, list):
                await self.send_error("No valid coding question available")
                return
            self._first_question = first_question
            self.current_phase = InterviewPhase.DSA_CODING
            self._set_conductor_phase(self.current_phase)
            self.conductor.append_turn("interviewer", self._extract_speakable_text(inner))
            await self.send_message({"type": "phase_change", "phase": "dsa"})
            await self.send_message({"type": "question", "question": inner, "phase": "dsa", "audio": None, "spoken_text": None, "timestamp": datetime.now(timezone.utc).isoformat()})
            asyncio.create_task(self._persist_conductor_state())
            return
        self.current_phase = InterviewPhase.GREETING
        self._set_conductor_phase(self.current_phase)
        user_name = session_data.get("candidate_name") or ((session_data.get("resume_data") or {}).get("name") or {}).get("raw") if isinstance(session_data.get("resume_data"), dict) else session_data.get("user_id", "Candidate")
        role = session_data.get("custom_role") or session_data.get("interview_type", "technical")

        greeting = await self.interview_service.generate_greeting(user_name, role)
        self._first_question = first_question
        await self._speak_response(greeting)

    async def cleanup(self) -> None:
        self._room_connected = False
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
            with suppress(asyncio.CancelledError):
                await self.heartbeat_task
        if self._silence_watchdog_task:
            self._silence_watchdog_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._silence_watchdog_task
        if self._finalize_timeout_task:
            self._finalize_timeout_task.cancel()
        if self._speech_end_confirm_task:
            self._speech_end_confirm_task.cancel()
        await self._cancel_active_tts("cleanup")
        if self.stt_service:
            await self.stt_service.close()
        self.tts_cache.clear()
        logger.info("LiveKit handler cleanup done for %s", self.session_id)


async def run_livekit_room_handler(session_id: str, user_id: str, prewarm: bool = False) -> None:
    """Entrypoint: mint bot token, connect room, run handler until user disconnects."""
    from livekit.rtc import Room
    room = Room()
    handler = InterviewLiveKitHandler(session_id, user_id, room, prewarm=prewarm)
    disconnect_future: asyncio.Future[None] = asyncio.get_running_loop().create_future()
    handler._disconnect_future = disconnect_future

    def on_data(data_packet: Any) -> None:
        asyncio.create_task(handler.on_data(data_packet))

    def on_participant_disconnected(participant: Any, *_args: Any, **_kwargs: Any) -> None:
        participant_identity = getattr(participant, "identity", None)
        if participant_identity and str(participant_identity) != str(user_id):
            return
        asyncio.create_task(handler._on_participant_disconnected(participant))

    def on_participant_connected(participant: Any, *_args: Any, **_kwargs: Any) -> None:
        participant_identity = getattr(participant, "identity", None)
        if participant_identity and str(participant_identity) != str(user_id):
            return
        if handler._candidate_joined is not None:
            handler._candidate_joined.set()
        if handler._disconnect_task and not handler._disconnect_task.done():
            handler._disconnect_task.cancel()
        asyncio.create_task(handler._on_participant_reconnected(participant))

    def on_disconnected(_reason: Any, *_args: Any, **_kwargs: Any) -> None:
        if not disconnect_future.done():
            disconnect_future.set_result(None)

    room.on("data_received", on_data)
    room.on("participant_disconnected", on_participant_disconnected)
    room.on("participant_connected", on_participant_connected)
    room.on("disconnected", on_disconnected)

    try:
        bot_token = _mint_bot_token(session_id)
        await room.connect(settings.livekit_url, bot_token)
        await handler.initialize()
        await disconnect_future
    except Exception as e:
        logger.error("LiveKit room handler error: %s", e, exc_info=True)
        await handler.send_error("A connection error occurred. Please try again or use the standard connection.")
    finally:
        await handler.cleanup()
        try:
            await room.disconnect()
        except Exception:
            pass
