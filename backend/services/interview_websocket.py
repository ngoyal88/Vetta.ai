# backend/services/interview_websocket.py
"""
FIXED: WebSocket Handler with proper audio processing
Changes:
1. Removed blocking conditions
2. Added detailed logging
3. Fixed audio flow
"""
import asyncio
import json
import base64
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.deepgram_service import DeepgramSTTService
from services.edge_tts_service import EdgeTTSService
# If you want to switch back to ElevenLabs later:
# from services.elevenlabs_service import ElevenLabsTTSService
from services.elevenlabs_service import TTSCache
from services.interview_service import InterviewService
from utils.redis_client import get_session, update_session
from utils.logger import get_logger
from config import get_settings

logger = get_logger("InterviewWebSocket")
settings = get_settings()


class InterviewPhase(str, Enum):
    GREETING = "greeting"
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    DSA_CODING = "dsa"
    WRAP_UP = "wrap_up"
    FEEDBACK = "feedback"
    ENDED = "ended"


class InterviewWebSocketHandler:
    """FIXED: WebSocket handler with proper audio flow"""
    
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.session_key = f"interview:{session_id}"
        
        # Services
        self.stt_service: Optional[DeepgramSTTService] = None
        # TTS provider: Edge TTS by default (free-ish).
        # Switch back to ElevenLabs later by setting `tts_provider` to "elevenlabs"
        # and replacing the below with: `self.tts_service = ElevenLabsTTSService()`
        tts_provider = (getattr(settings, "tts_provider", "edge") or "edge").strip().lower()
        if tts_provider == "elevenlabs":
            # self.tts_service = ElevenLabsTTSService()  # requires ELEVENLABS_API_KEY
            # Keeping Edge as runtime default for now.
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
        
        # State
        self.current_phase = InterviewPhase.GREETING
        self.is_processing = False
        self.is_ai_speaking = False
        self.current_transcript = []
        self.current_answer_parts = []
        self.latest_interim_transcript: str = ""
        self.awaiting_response = False

        # Greeting flow
        self._first_question: Optional[Dict[str, Any]] = None
        
        # Locks
        self.processing_lock = asyncio.Lock()
        self.speech_lock = asyncio.Lock()
        
        # Monitoring
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
            
            logger.info(f"📋 Session loaded: {session_data.get('interview_type')}")
            
            # Initialize STT with callback
            logger.info("🎤 Initializing Deepgram STT...")
            self.stt_service = DeepgramSTTService(
                on_transcript=self._on_transcript_received
            )
            
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
    
    async def _handle_audio(self, audio_bytes: bytes):
        """
        FIXED: Handle audio without blocking
        """
        self.audio_chunks_received += 1
        
        # Log every 10th chunk
        if self.audio_chunks_received % 10 == 0:
            logger.info(
                f"🎵 Received {self.audio_chunks_received} audio chunks ({len(audio_bytes)} bytes) "
                f"ai_speaking={self.is_ai_speaking}"
            )
        
        # CRITICAL FIX: Don't block on is_processing!
        # Only check if AI is speaking (echo prevention)
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

        if self.processing_lock.locked():
            logger.warning("⚠️ Already processing; ignoring answer_complete")
            return

        async with self.processing_lock:
            self.is_processing = True
            try:
                # Special-case: greeting phase expects a short intro from the candidate.
                # Do NOT advance question index here; just store intro and ask the first real question.
                if self.current_phase == InterviewPhase.GREETING:
                    await self.send_status("thinking")
                    session_data = await get_session(self.session_key)
                    if session_data is not None:
                        session_data["candidate_intro"] = complete_text
                        await update_session(self.session_key, session_data)

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
    
    async def _start_greeting(self, session_data: Dict[str, Any]):
        """Send initial greeting"""
        try:
            logger.info("👋 Starting greeting...")
            
            self.current_phase = InterviewPhase.GREETING
            
            user_name = session_data.get("candidate_name") or (
                (session_data.get("resume_data", {}) or {}).get("name", {}).get("raw")
                if isinstance(session_data.get("resume_data"), dict) else None
            ) or session_data.get("user_id", "Candidate")
            interview_type = session_data.get("interview_type", "technical")
            custom_role = session_data.get("custom_role")
            role = custom_role or interview_type
            
            # Generate greeting
            greeting = await self.interview_service.generate_greeting(user_name, role)
            logger.info(f"✅ Greeting: {greeting}")
            
            # Get first question
            questions = session_data.get("questions", [])
            first_question = questions[0] if questions else None
            
            if not first_question:
                await self.send_error("No questions available")
                return

            # Save for after the candidate intro.
            self._first_question = first_question
            
            logger.info(f"✅ First question ready: {first_question}")
            
            # Send greeting only; wait for candidate intro before sending Q1.
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
                    # Still send the text so UI doesn't go silent
                    await self.send_message({
                        "type": "question",
                        "question": response,
                        "phase": self.current_phase.value,
                        "audio": None,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    await self.send_error("TTS failed: no audio generated")
                    self.is_ai_speaking = False
                    return
                
                # Send to client
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
        # Implementation here
    
    async def _end_interview(self):
        """End interview"""
        logger.info("🏁 Ending interview")
        self.current_phase = InterviewPhase.ENDED
        # Implementation here
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeats"""
        try:
            while True:
                await asyncio.sleep(30)
                await self.send_message({"type": "heartbeat"})
        except asyncio.CancelledError:
            pass
    
    # Message senders
    
    async def send_question(self, question: Dict[str, Any], audio: bytes, spoken_text: Optional[str] = None):
        """Send question with audio"""
        message = {
            "type": "question",
            "question": question,
            "phase": self.current_phase.value,
            "spoken_text": spoken_text,
            "audio": base64.b64encode(audio).decode("utf-8"),
            "audio_content_type": "audio/mpeg",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
        logger.info("📤 Sent question with audio")
    
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