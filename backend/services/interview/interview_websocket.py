"""
WebSocket handler for real-time interview (audio, STT, TTS, LLM).
"""
import asyncio
import json
import base64
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.integrations import DeepgramSTTService, EdgeTTSService, TTSCache
from services.interview.interview_service import InterviewService
from models.interview import InterviewType, DifficultyLevel
from utils.redis_client import get_session, update_session
from utils.logger import get_logger
from utils.feedback_parser import parse_scores_from_feedback
from config import get_settings
from firebase_config import db
from firebase_admin import firestore

logger = get_logger("InterviewWebSocket")
settings = get_settings()
SESSION_TTL = getattr(settings, "interview_session_ttl_seconds", 7200)


class InterviewPhase(str, Enum):
    GREETING = "greeting"
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    DSA_CODING = "dsa"
    WRAP_UP = "wrap_up"
    FEEDBACK = "feedback"
    ENDED = "ended"


class InterviewWebSocketHandler:
    """Handles interview flow over WebSocket."""

    def __init__(self, websocket: WebSocket, session_id: str, user_id: Optional[str] = None):
        self.websocket = websocket
        self.session_id = session_id
        self.session_key = f"interview:{session_id}"
        self.user_id = user_id

        self.stt_service: Optional[DeepgramSTTService] = None
        # TTS: Edge by default. Use TTS_PROVIDER=elevenlabs and ElevenLabsTTSService() to switch.
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

        self.current_phase = InterviewPhase.GREETING
        self.is_processing = False
        self.is_ai_speaking = False
        self.current_transcript = []
        self.current_answer_parts = []
        self.latest_interim_transcript: str = ""
        self.awaiting_response = False

        self._first_question: Optional[Dict[str, Any]] = None
        self._session_started_at: Optional[datetime] = None  # For max duration enforcement

        self.processing_lock = asyncio.Lock()
        self.speech_lock = asyncio.Lock()

        self.last_activity = datetime.now(timezone.utc)
        self.heartbeat_task = None
        self.audio_chunks_received = 0
        
        logger.info(f"✅ WebSocket handler initialized for session: {session_id}")

    async def handle_connection(self):
        """Main connection handler"""
        try:
            # Accept WebSocket
            await self.websocket.accept()
            logger.info(f"✅ WebSocket connected: {self.session_id}")
            
            # Load session
            session_data = await get_session(self.session_key)
            if not session_data:
                await self.send_error("Session not found")
                return
            
            # Set session start for max duration enforcement
            started_at_raw = session_data.get("started_at")
            if isinstance(started_at_raw, str):
                try:
                    self._session_started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
                except Exception:
                    self._session_started_at = datetime.now(timezone.utc)
            elif isinstance(started_at_raw, datetime):
                self._session_started_at = started_at_raw if started_at_raw.tzinfo else started_at_raw.replace(tzinfo=timezone.utc)
            else:
                self._session_started_at = datetime.now(timezone.utc)
            
            logger.info(f"📋 Session loaded: {session_data.get('interview_type')}")
            
            # Initialize STT with callback (gracefully fail if not configured)
            if not settings.deepgram_api_key:
                await self.send_error("Speech service not configured")
                await self.websocket.close(code=1011)
                return

            logger.info("🎤 Initializing Deepgram STT...")
            self.stt_service = DeepgramSTTService(on_transcript=self._on_transcript_received)
            
            # Connect to Deepgram
            if not await self.stt_service.connect():
                await self.send_error("Failed to connect to speech service")
                return
            
            await self.send_status("connected")
            logger.info("✅ All services connected")
            
            # Start heartbeat
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            
            # Send greeting
            await self._start_greeting(session_data)
            
            # Listen for messages
            await self._message_loop()
            
        except WebSocketDisconnect:
            logger.info(f"🔌 Client disconnected: {self.session_id}")
        except Exception as e:
            logger.error(f"❌ WebSocket error: {e}", exc_info=True)
            await self.send_error(str(e))
        finally:
            await self.cleanup()
    
    async def _message_loop(self):
        """Listen for and process client messages"""
        while True:
            # Break if websocket already disconnected
            if self.websocket.client_state == WebSocketState.DISCONNECTED or \
               self.websocket.application_state == WebSocketState.DISCONNECTED:
                logger.info(f"WebSocket disconnected, stopping receive loop: {self.session_id}")
                break
            try:
                data = await asyncio.wait_for(
                    self.websocket.receive(),
                    timeout=60.0
                )
                
                self.last_activity = datetime.now(timezone.utc)
                
                text_payload = data.get("text")
                bytes_payload = data.get("bytes")

                # Starlette includes both keys; one is None.
                if text_payload is not None:
                    try:
                        message = json.loads(text_payload)
                    except Exception:
                        logger.warning("⚠️ Received non-JSON text payload")
                        continue
                    await self._handle_message(message)

                elif bytes_payload is not None:
                    # CRITICAL: Process audio immediately
                    await self._handle_audio(bytes_payload)
                
            except asyncio.TimeoutError:
                logger.warning(f"⏰ Receive timeout for {self.session_id}")
                continue
            except WebSocketDisconnect:
                break
            except RuntimeError as e:
                # Starlette raises RuntimeError when a disconnect frame was received
                if "Cannot call \"receive\" once a disconnect" in str(e):
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
        
        if msg_type == "start_recording":
            # Don't block - just acknowledge
            await self.send_status("listening")
            logger.info("🎤 Client started recording")
        
        elif msg_type == "stop_recording":
            await self.send_status("processing")
            logger.info("🛑 Client stopped recording")

        elif msg_type == "ai_playback_ended":
            # Frontend finished playing the latest AI audio.
            async with self.speech_lock:
                self.is_ai_speaking = False
            await self.send_status("listening")
            logger.info("🔇 Client reported AI playback ended; resuming mic")

        elif msg_type == "answer_complete":
            logger.info("✅ Client marked answer complete")
            await self._finalize_current_answer()
        
        elif msg_type == "interrupt":
            await self._handle_interruption()
        
        elif msg_type == "skip_question":
            await self._handle_skip_question()
        
        elif msg_type == "end_interview":
            await self._end_interview()
        
        elif msg_type == "ping":
            await self.send_message({"type": "pong"})

        elif msg_type == "dsa_next_question":
            await self._handle_dsa_next_question()

    async def _handle_dsa_next_question(self):
        """Generate and send next DSA question (no TTS)."""
        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                await self.send_error("Session not found")
                return
            questions = session_data.get("questions", []) or []
            current_q_index = int(session_data.get("current_question_index", 0))
            try:
                difficulty = DifficultyLevel(session_data.get("difficulty", "medium"))
            except Exception:
                difficulty = DifficultyLevel.MEDIUM
            context = self.interview_service._build_context(
                InterviewType.DSA,
                session_data.get("resume_data"),
                session_data.get("custom_role"),
                session_data.get("years_experience"),
            )
            next_question_raw = await self.interview_service._generate_dsa_question(difficulty, context)
            next_question_obj = {
                "question": next_question_raw,
                "type": "coding",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            questions.append(next_question_obj)
            session_data["questions"] = questions
            session_data["current_question_index"] = current_q_index + 1
            session_data["last_updated"] = datetime.now(timezone.utc).isoformat()
            await update_session(self.session_key, session_data, expire_seconds=SESSION_TTL)
            self.current_phase = InterviewPhase.DSA_CODING
            await self.send_message({"type": "phase_change", "phase": "dsa"})
            await self.send_message({
                "type": "question",
                "question": next_question_raw,
                "phase": "dsa",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            logger.info("📤 Sent next DSA question (no audio)")
        except Exception as e:
            logger.error(f"❌ dsa_next_question error: {e}", exc_info=True)
            await self.send_error("Failed to load next question")
    
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
        
        # Send to Deepgram immediately
        if self.stt_service:
            try:
                await self.stt_service.send_audio(audio_bytes)
            except Exception as e:
                logger.error(f"❌ Error sending audio to STT: {e}")
        else:
            logger.warning("⚠️ STT service not initialized")
    
    def _on_transcript_received(self, text: str, is_final: bool):
        """Callback from STT - run in async context"""
        asyncio.create_task(self._process_transcript(text, is_final))
    
    async def _process_transcript(self, text: str, is_final: bool):
        """Process transcription"""
        try:
            # Send to client immediately
            await self.send_transcript(text, is_final)
            
            if not is_final:
                self.latest_interim_transcript = text
                self.current_transcript.append(text)
                return
            
            # Final transcript segment received; buffer it.
            final_segment = text.strip()
            if final_segment:
                self.current_answer_parts.append(final_segment)
                logger.info(f"📝 Buffered final transcript segment ({len(final_segment)} chars)")

            # Reset interim since we have a final now.
            self.latest_interim_transcript = ""
            self.current_transcript.clear()
        
        except Exception as e:
            logger.error(f"❌ Transcript processing error: {e}", exc_info=True)

    async def _finalize_current_answer(self):
        """Manually finalize the current answer and generate follow-up/next question."""
        # Build answer from buffered final segments; optionally include last interim.
        parts = list(self.current_answer_parts)
        interim = (self.latest_interim_transcript or "").strip()
        if interim:
            parts.append(interim)

        complete_text = " ".join([p for p in parts if p]).strip()

        # Clear buffers immediately so repeated clicks don't duplicate.
        self.current_answer_parts.clear()
        self.latest_interim_transcript = ""
        self.current_transcript.clear()

        if not complete_text or len(complete_text) < 3:
            logger.info("⚠️ No answer text to process")
            await self.send_error("No answer captured yet. Please speak a bit more.")
            return
        max_answer_length = 10_000
        if len(complete_text) > max_answer_length:
            logger.warning(f"Answer too long ({len(complete_text)} chars) for session {self.session_id}")
            await self.send_error("Answer is too long. Please summarize.")
            return

        if self.processing_lock.locked():
            logger.warning("⚠️ Already processing; ignoring answer_complete")
            return

        if self.current_phase == InterviewPhase.DSA_CODING:
            logger.info("⏭️ Ignoring answer_complete in DSA phase — use REST /submit-code")
            return

        async with self.processing_lock:
            self.is_processing = True
            try:
                # Enforce max interview duration
                max_duration_min = getattr(settings, "max_interview_duration_minutes", 60)
                if self._session_started_at and max_duration_min > 0:
                    elapsed_min = (datetime.now(timezone.utc) - self._session_started_at).total_seconds() / 60
                    if elapsed_min >= max_duration_min:
                        logger.info(f"Max interview duration ({max_duration_min} min) reached for {self.session_id}")
                        await self._end_interview()
                        return
                # Special-case: greeting phase expects a short intro from the candidate.
                # Do NOT advance question index here; just store intro and ask the first real question.
                if self.current_phase == InterviewPhase.GREETING:
                    await self.send_status("thinking")
                    session_data = await get_session(self.session_key)
                    if session_data is not None:
                        session_data["candidate_intro"] = complete_text
                        await update_session(self.session_key, session_data, expire_seconds=SESSION_TTL)

                    first_question = None
                    if self._first_question is not None:
                        first_question = self._first_question
                    else:
                        # Fallback: read from session questions[0]
                        if session_data:
                            questions = session_data.get("questions", []) or []
                            if questions:
                                first_question = questions[0]

                    if not first_question:
                        await self.send_error("No questions available")
                        return

                    self.current_phase = InterviewPhase.BEHAVIORAL
                    await self._speak_response(first_question)
                    return

                await self.send_status("thinking")
                logger.info(f"🤔 Processing submitted answer ({len(complete_text)} chars)...")
                response = await asyncio.wait_for(
                    self.interview_service.process_answer_and_generate_followup(
                        self.session_id,
                        complete_text,
                    ),
                    timeout=30.0,
                )

                logger.info("✅ Got response, generating audio...")
                await self._speak_response(response)

            except asyncio.TimeoutError:
                logger.error("⏰ Processing timeout")
                await self.send_error("Processing timeout")
            except Exception as e:
                logger.error(f"❌ Processing error: {e}", exc_info=True)
                await self.send_error("Failed to process answer")
            finally:
                self.is_processing = False
                await self.send_status("listening")
    
    async def _handle_interruption(self):
        """Handle user interrupt"""
        logger.info("🛑 User interrupted AI")
        
        async with self.speech_lock:
            self.is_ai_speaking = False
        
        self.current_transcript.clear()
        await self.send_status("listening")
        await self.send_message({"type": "interrupted"})
    
    def _is_dsa_session(self, session_data: Dict[str, Any]) -> bool:
        """True if this session is a DSA (coding) interview."""
        it = session_data.get("interview_type") or ""
        return str(it).lower() == "dsa"
    
    def _get_dsa_inner_question(self, payload: Any) -> Optional[Dict[str, Any]]:
        """Return the inner DSA object from a wrapper or the payload itself if already inner."""
        if not isinstance(payload, dict):
            return None
        if payload.get("type") == "coding" and isinstance(payload.get("question"), dict):
            return payload["question"]
        if isinstance(payload.get("title"), str) and "test_cases" in payload:
            return payload
        return None
    
    async def _start_greeting(self, session_data: Dict[str, Any]):
        """Send initial greeting, or for DSA go straight to first coding question."""
        try:
            logger.info("👋 Starting greeting...")
            
            questions = session_data.get("questions", [])
            first_question = questions[0] if questions else None
            
            if not first_question:
                await self.send_error("No questions available")
                return
            
            # DSA: skip voice greeting, send phase_change then question (inner, no audio)
            if self._is_dsa_session(session_data):
                inner = self._get_dsa_inner_question(first_question) or first_question
                test_cases = inner.get("test_cases") if isinstance(inner, dict) else []
                if not test_cases or not isinstance(test_cases, list):
                    await self.send_error("No valid coding question available")
                    return
                self._first_question = first_question
                self.current_phase = InterviewPhase.DSA_CODING
                await self.send_message({"type": "phase_change", "phase": "dsa"})
                await self.send_message({
                    "type": "question",
                    "question": inner,
                    "phase": "dsa",
                    "audio": None,
                    "spoken_text": None,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                logger.info("✅ DSA: sent phase_change + first question (no audio)")
                return
            
            # Non-DSA: voice greeting, then wait for answer_complete to send first question
            self.current_phase = InterviewPhase.GREETING
            user_name = session_data.get("candidate_name") or (
                (session_data.get("resume_data", {}) or {}).get("name", {}).get("raw")
                if isinstance(session_data.get("resume_data"), dict) else None
            ) or session_data.get("user_id", "Candidate")
            interview_type = session_data.get("interview_type", "technical")
            custom_role = session_data.get("custom_role")
            role = custom_role or interview_type
            
            greeting = await self.interview_service.generate_greeting(user_name, role)
            logger.info(f"✅ Greeting: {greeting}")
            self._first_question = first_question
            logger.info(f"✅ First question ready: {first_question}")
            await self._speak_response(greeting)
            logger.info("✅ Greeting sent; awaiting candidate intro")
            
        except Exception as e:
            logger.error(f"❌ Greeting error: {e}", exc_info=True)
            await self.send_error("Failed to start interview")
    
    async def _speak_response(self, response: Dict[str, Any]):
        """Convert response to speech"""
        async with self.speech_lock:
            try:
                # Set speaking flag BEFORE generating
                self.is_ai_speaking = True
                
                # Extract text
                speak_text = self._extract_speakable_text(response)

                # Keep client phase aligned with the question type
                if isinstance(response, dict) and response.get("type") == "coding":
                    if self.current_phase != InterviewPhase.DSA_CODING:
                        await self.send_message({"type": "phase_change", "phase": "dsa"})
                    self.current_phase = InterviewPhase.DSA_CODING
                elif self.current_phase == InterviewPhase.DSA_CODING:
                    # Shift back to behavioral/technical when leaving coding
                    self.current_phase = InterviewPhase.BEHAVIORAL
                    await self.send_message({"type": "phase_change", "phase": "behavioral"})
                
                if not speak_text:
                    logger.warning("⚠️ No speakable text")
                    self.is_ai_speaking = False
                    return
                
                logger.info(f"🗣️ Speaking: {speak_text[:100]}...")
                
                # Check cache
                cached_audio = self.tts_cache.get(speak_text)
                
                if cached_audio:
                    logger.info("📦 Using cached audio")
                    audio_data = cached_audio
                else:
                    # Generate audio
                    await self.send_status("speaking")
                    audio_data = await self.tts_service.text_to_speech(speak_text)
                    
                    if audio_data:
                        self.tts_cache.put(speak_text, audio_data)
                        logger.info(f"✅ Generated {len(audio_data)} bytes of audio")
                
                if not audio_data:
                    logger.error("❌ No audio generated")
                    inner = self._get_dsa_inner_question(response) or response
                    await self.send_message({
                        "type": "question",
                        "question": inner,
                        "phase": self.current_phase.value,
                        "audio": None,
                        "spoken_text": speak_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    await self.send_error("TTS failed: no audio generated")
                    self.is_ai_speaking = False
                    return
                
                # Send to client (inner object used inside send_question for DSA)
                await self.send_question(response, audio_data, speak_text)
                
                # Client will notify when done playing
                
            except Exception as e:
                logger.error(f"❌ TTS error: {e}", exc_info=True)
                await self.send_error("Failed to generate speech")
                self.is_ai_speaking = False
    
    def _extract_speakable_text(self, response: Dict[str, Any]) -> str:
        """Extract text to speak"""
        if isinstance(response, str):
            return response
        
        if isinstance(response, dict):
            # DSA question
            if response.get("type") == "coding":
                title = response.get("title", "")
                description = response.get("description", "")
                return f"{title}. {description[:200]}..."
            
            # Regular question
            question = response.get("question")
            if isinstance(question, dict):
                return question.get("question", "")
            elif isinstance(question, str):
                return question
        
        return str(response)
    
    async def _handle_skip_question(self):
        """Skip current question"""
        logger.info("⏭️ Skipping question")
        try:
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
                difficulty = DifficultyLevel(session_data.get("difficulty", "medium"))
            except Exception:
                difficulty = DifficultyLevel.MEDIUM

            responses = session_data.get("responses", []) or []
            skipped_question = questions[current_q_index] if current_q_index < len(questions) else None
            if skipped_question:
                responses.append({
                    "question_index": current_q_index,
                    "question": skipped_question,
                    "response": "[skipped by user]",
                    "skipped": True,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

            # Generate next question
            if interview_type == InterviewType.DSA:
                context = self.interview_service._build_context(
                    interview_type,
                    session_data.get("resume_data"),
                    session_data.get("custom_role"),
                    session_data.get("years_experience"),
                )
                next_question_raw = await self.interview_service._generate_dsa_question(difficulty, context)
                next_question_obj = {
                    "question": next_question_raw,
                    "type": "coding",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            else:
                follow_up_text = await self.interview_service.generate_follow_up(responses, interview_type)
                next_question_obj = {
                    "question": {"question": follow_up_text},
                    "type": interview_type.value,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

            questions.append(next_question_obj)
            session_data["questions"] = questions
            session_data["responses"] = responses
            session_data["current_question_index"] = current_q_index + 1
            session_data["last_updated"] = datetime.now(timezone.utc).isoformat()

            await update_session(self.session_key, session_data, expire_seconds=SESSION_TTL)

            if next_question_obj.get("type") == "coding":
                self.current_phase = InterviewPhase.DSA_CODING
                await self.send_message({"type": "phase_change", "phase": "dsa"})
                inner = self._get_dsa_inner_question(next_question_obj) or next_question_obj
                await self.send_message({
                    "type": "question",
                    "question": inner,
                    "phase": "dsa",
                    "audio": None,
                    "spoken_text": None,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                logger.info("📤 Sent skipped DSA question (no audio)")
            else:
                await self._speak_response(next_question_obj)

        except Exception as e:
            logger.error(f"❌ Skip question error: {e}", exc_info=True)
            await self.send_error("Failed to skip question")
    
    async def _end_interview(self):
        """End interview"""
        logger.info("🏁 Ending interview")
        if self.current_phase == InterviewPhase.ENDED:
            return

        self.current_phase = InterviewPhase.FEEDBACK

        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                await self.send_error("Session not found")
                return

            # Compute duration
            started_at_raw = session_data.get("started_at")
            started_at = None
            if isinstance(started_at_raw, str):
                try:
                    started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
                except Exception:
                    started_at = None
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

            # Update session state
            completion_reason = "ended_early" if session_data.get("status") != "completed" else "completed"
            completed_ts = datetime.now(timezone.utc).isoformat()

            session_data["status"] = "ended_early"
            session_data["completion_reason"] = completion_reason
            session_data["completed_at"] = completed_ts
            session_data["last_updated"] = completed_ts
            session_data["final_feedback"] = final_feedback
            session_data["duration_minutes"] = duration_minutes
            session_data["questions_answered"] = len(session_data.get("responses", []))
            session_data["code_problems_attempted"] = len(session_data.get("code_submissions", []))

            await update_session(self.session_key, session_data, expire_seconds=SESSION_TTL)

            # Persist to Firestore (best effort)
            try:
                payload = {
                    "status": "ended_early",
                    "completion_reason": completion_reason,
                    "completed_at": firestore.SERVER_TIMESTAMP,
                    "last_updated": firestore.SERVER_TIMESTAMP,
                    "duration_minutes": duration_minutes,
                    "questions_answered": len(session_data.get("responses", [])),
                    "code_problems_attempted": len(session_data.get("code_submissions", [])),
                    "responses": session_data.get("responses", []),
                    "questions": session_data.get("questions", []),
                    "code_submissions": session_data.get("code_submissions", []),
                    "final_feedback": final_feedback,
                    "scores": scores or None,
                }
                db.collection("interviews").document(self.session_id).set(payload, merge=True)
            except Exception as fe:
                logger.warning(f"Failed to persist early completion to Firestore: {fe}")

            await self.send_message({
                "type": "feedback",
                "feedback": final_feedback.get("feedback") if isinstance(final_feedback, dict) else final_feedback,
                "full": final_feedback,
                "duration_minutes": duration_minutes,
                "questions_answered": len(session_data.get("responses", [])),
                "code_problems_attempted": len(session_data.get("code_submissions", [])),
                "status": "ended_early",
                "timestamp": completed_ts,
            })

            await self.send_status("completed")

        except Exception as e:
            logger.error(f"❌ Error ending interview: {e}", exc_info=True)
            await self.send_error("Failed to finalize interview")
        finally:
            async with self.speech_lock:
                self.is_ai_speaking = False
            self.current_phase = InterviewPhase.ENDED
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeats"""
        try:
            while True:
                await asyncio.sleep(30)
                await self.send_message({"type": "heartbeat"})
        except asyncio.CancelledError:
            pass
    
    # Message senders
    
    async def send_question(self, question: Dict[str, Any], audio: Optional[bytes], spoken_text: Optional[str] = None):
        """Send question (with or without audio). For DSA/coding, normalizes to inner object so client gets correct shape."""
        inner = self._get_dsa_inner_question(question) or question
        message = {
            "type": "question",
            "question": inner,
            "phase": self.current_phase.value,
            "spoken_text": spoken_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
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
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
    
    async def send_status(self, status: str):
        """Send status"""
        message = {
            "type": "status",
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
        logger.debug(f"📊 Status: {status}")
    
    async def send_error(self, error_message: str):
        """Send error"""
        message = {
            "type": "error",
            "message": error_message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
        logger.error(f"❌ Sent error: {error_message}")
    
    async def send_message(self, message: Dict[str, Any]):
        """Send message"""
        try:
            if self.websocket.client_state == WebSocketState.DISCONNECTED or \
               self.websocket.application_state == WebSocketState.DISCONNECTED:
                return
            await self.websocket.send_json(message)
        except Exception as e:
            logger.error(f"❌ Failed to send message: {e}")
    
    async def cleanup(self):
        """Cleanup"""
        logger.info(f"🧹 Cleaning up session: {self.session_id}")
        
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
        
        if self.stt_service:
            await self.stt_service.close()
        
        self.tts_cache.clear()
        
        logger.info(f"✅ Cleanup complete. Received {self.audio_chunks_received} audio chunks total")

