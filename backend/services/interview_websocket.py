# backend/services/interview_websocket.py
"""
Enhanced WebSocket Handler with complete edge case handling
Handles: Echo prevention, interruptions, timeouts, errors, concurrent requests
"""
import asyncio
import json
import base64
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect

from services.deepgram_service import DeepgramSTTService
from services.elevenlabs_service import ElevenLabsTTSService, TTSCache
from services.interview_service import InterviewService
from utils.redis_client import get_session, update_session
from utils.logger import get_logger

logger = get_logger("InterviewWebSocket")


class InterviewPhase(str, Enum):
    """Interview phases"""
    GREETING = "greeting"
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    DSA_CODING = "dsa"
    WRAP_UP = "wrap_up"
    FEEDBACK = "feedback"
    ENDED = "ended"


class InterviewWebSocketHandler:
    """Enhanced WebSocket handler with complete edge case handling"""
    
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.session_key = f"interview:{session_id}"
        
        # Services
        self.stt_service: Optional[DeepgramSTTService] = None
        self.tts_service = ElevenLabsTTSService()
        self.interview_service = InterviewService()
        self.tts_cache = TTSCache()
        
        # State
        self.current_phase = InterviewPhase.GREETING
        self.is_processing = False
        self.is_ai_speaking = False
        self.current_transcript = []
        self.awaiting_response = False
        
        # Locks and queues
        self.processing_lock = asyncio.Lock()
        self.speech_lock = asyncio.Lock()
        self.audio_buffer = []
        
        # Timeouts and monitoring
        self.last_activity = datetime.now(timezone.utc)
        self.connection_timeout = 300  # 5 minutes
        self.processing_timeout = 30  # 30 seconds
        self.heartbeat_task = None
        self.timeout_task = None
        
        # Error tracking
        self.error_count = 0
        self.max_errors = 5
        
    async def handle_connection(self):
        """Main connection handler with comprehensive error handling"""
        try:
            # Accept WebSocket connection
            await self.websocket.accept()
            logger.info(f"✅ WebSocket connected: {self.session_id}")
            
            # Load session
            session_data = await get_session(self.session_key)
            if not session_data:
                await self.send_error("Session not found")
                return
            
            # Initialize STT with callback
            self.stt_service = DeepgramSTTService(
                on_transcript=self._on_transcript_received
            )
            
            # Connect to Deepgram
            if not await self.stt_service.connect():
                await self.send_error("Failed to connect to speech service")
                return
            
            await self.send_status("connected")
            
            # Start monitoring tasks
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            self.timeout_task = asyncio.create_task(self._timeout_monitor())
            
            # Listen for client messages
            await self._message_loop()
            
        except WebSocketDisconnect:
            logger.info(f"Client disconnected: {self.session_id}")
        except Exception as e:
            logger.error(f"WebSocket error: {e}", exc_info=True)
            await self.send_error(str(e))
        finally:
            await self.cleanup()
    
    async def _message_loop(self):
        """Listen for and process client messages with error handling"""
        while True:
            try:
                if self.websocket.client_state.name == "DISCONNECTED":
                    break

                # Receive message with timeout
                data = await asyncio.wait_for(
                    self.websocket.receive(),
                    timeout=60.0  # 60 second timeout
                )
                
                self.last_activity = datetime.now(timezone.utc)
                
                if "text" in data:
                    message = json.loads(data["text"])
                    await self._handle_message(message)
                
                elif "bytes" in data:
                    # Audio data - only accept if not AI speaking
                    if not self.is_ai_speaking:
                        await self._handle_audio(data["bytes"])
                    else:
                        logger.debug("Ignoring audio - AI is speaking (echo prevention)")
                
            except asyncio.TimeoutError:
                logger.warning(f"Receive timeout for session {self.session_id}")
                continue
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON: {e}")
                await self.send_error("Invalid message format")
                self.error_count += 1
            except Exception as e:
                logger.error(f"Message processing error: {e}", exc_info=True)
                await self.send_error("Message processing failed")
                self.error_count += 1
            
            # Check error threshold
            if self.error_count >= self.max_errors:
                logger.error(f"Max errors reached for session {self.session_id}")
                await self.send_error("Too many errors. Please reconnect.")
                break
    
    async def _handle_message(self, message: Dict[str, Any]):
        """Handle text messages from client"""
        msg_type = message.get("type")

        if msg_type == "start":
        # Send greeting when user clicks "Start Interview"
            session_data = await get_session(self.session_key)
            if session_data:
                await self._start_greeting(session_data)
            return
        
        if msg_type == "start_recording":
            if self.is_ai_speaking:
                logger.warning("Cannot start recording - AI is speaking")
                await self.send_error("Please wait for AI to finish speaking")
                return
            await self.send_status("listening")
            logger.info("🎤 Client started recording")
        
        elif msg_type == "stop_recording":
            await self.send_status("processing")
            logger.info("🛑 Client stopped recording")
            # Transcript will be processed in callback
        
        elif msg_type == "interrupt":
            await self._handle_interruption()
        
        elif msg_type == "skip_question":
            await self._handle_skip_question()
        
        elif msg_type == "end_interview":
            await self._end_interview()
        
        elif msg_type == "ping":
            await self.send_message({"type": "pong"})
        
        else:
            logger.warning(f"Unknown message type: {msg_type}")
    
    async def _handle_audio(self, audio_bytes: bytes):
        """Handle audio data with buffer management"""
        if self.stt_service and not self.is_processing and not self.is_ai_speaking:
            try:
                await self.stt_service.send_audio(audio_bytes)
            except Exception as e:
                logger.error(f"Error sending audio to STT: {e}")
    
    def _on_transcript_received(self, text: str, is_final: bool):
        """Callback from STT service - handle in async context"""
        asyncio.create_task(self._process_transcript(text, is_final))
    
    async def _process_transcript(self, text: str, is_final: bool):
        """Process transcription with concurrent request handling"""
        try:
            # Send interim transcript to client
            await self.send_transcript(text, is_final)
            
            if not is_final:
                # Store interim transcript
                self.current_transcript.append(text)
                return
            
            # Prevent concurrent processing
            if self.is_processing:
                logger.warning("Already processing, skipping this transcript")
                return
            
            # Get complete transcript
            complete_text = " ".join(self.current_transcript + [text]).strip()
            self.current_transcript.clear()
            
            if not complete_text or len(complete_text) < 3:
                logger.debug("Transcript too short, ignoring")
                return
            
            logger.info(f"📝 Final transcript: {complete_text}")
            
            # Process user's answer with timeout
            async with self.processing_lock:
                self.is_processing = True
                await self.send_status("thinking")
                
                try:

                    if self.current_phase == InterviewPhase.GREETING:
                        session_data = await get_session(self.session_key)
                        questions = session_data.get("questions", [])
                        if questions:
                            first_question = questions[0]
                            self.current_phase = InterviewPhase.BEHAVIORAL
                            await self._speak_response(first_question)
                        return
                    
                    # Process with timeout
                    response = await asyncio.wait_for(
                        self.interview_service.process_answer_and_generate_followup(
                            self.session_id,
                            complete_text
                        ),
                        timeout=self.processing_timeout
                    )
                    
                    # Update phase if needed
                    await self._check_phase_transition(response)
                    
                    # Generate and send audio
                    await self._speak_response(response)
                    
                except asyncio.TimeoutError:
                    logger.error("Processing timeout")
                    await self.send_error("Processing timeout. Please try again.")
                except Exception as e:
                    logger.error(f"Processing error: {e}", exc_info=True)
                    await self.send_error("Failed to process answer")
                finally:
                    self.is_processing = False
                    await self.send_status("listening")
        
        except Exception as e:
            logger.error(f"Transcript processing error: {e}", exc_info=True)
    
    async def _handle_interruption(self):
        """Handle user interrupting AI"""
        logger.info("🛑 User interrupted AI")
        
        async with self.speech_lock:
            self.is_ai_speaking = False
        
        # Clear current transcript to start fresh
        self.current_transcript.clear()
        
        await self.send_status("listening")
        await self.send_message({"type": "interrupted"})
    
    async def _start_greeting(self, session_data: Dict[str, Any]):
        """Send initial greeting with error handling"""
        try:
            self.current_phase = InterviewPhase.GREETING
            
            user_name = session_data.get("user_id", "Candidate")
            interview_type = session_data.get("interview_type", "technical")
            custom_role = session_data.get("custom_role")
            role = custom_role or interview_type
            
            # Generate greeting
            greeting = await self.interview_service.generate_greeting(user_name, role)
            
            # Get first question
            questions = session_data.get("questions", [])
            first_question = questions[0] if questions else None
            
            if not first_question:
                await self.send_error("No questions available")
                return
            
            # Send greeting
            await self._speak_response({"question": greeting, "type": "greeting"})
            
            # Brief pause
            #await asyncio.sleep(1.5)
            
            # Send first question
            self.current_phase = InterviewPhase.BEHAVIORAL
            #await self._speak_response(first_question)
            
        except Exception as e:
            logger.error(f"Greeting error: {e}", exc_info=True)
            await self.send_error("Failed to start interview")
    
    async def _speak_response(self, response: Dict[str, Any]):
        """Convert response to speech with echo prevention"""
        async with self.speech_lock:
            try:
                # Set AI speaking flag BEFORE generating audio
                self.is_ai_speaking = True
                
                # Extract speakable text
                speak_text = self._extract_speakable_text(response)
                
                if not speak_text:
                    logger.warning("No speakable text in response")
                    self.is_ai_speaking = False
                    return
                
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
                
                if not audio_data:
                    logger.error("No audio generated")
                    self.is_ai_speaking = False
                    return
                
                # Send question + audio to client
                await self.send_question(response, audio_data)
                
                # Keep is_ai_speaking True - client will notify when done
                
            except Exception as e:
                logger.error(f"TTS error: {e}", exc_info=True)
                await self.send_error("Failed to generate speech")
                self.is_ai_speaking = False
    
    def _extract_speakable_text(self, response: Dict[str, Any]) -> str:
        """Extract text to speak from response"""
        if isinstance(response, str):
            return response
        
        if isinstance(response, dict):
            # DSA question - speak only the title and description
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
    
    async def _check_phase_transition(self, response: Dict[str, Any]):
        """Check if we should transition to a new phase"""
        session_data = await get_session(self.session_key)
        if not session_data:
            return
        
        interview_type = session_data.get("interview_type", "")
        num_responses = len(session_data.get("responses", []))
        
        # Transition to DSA after 2-3 behavioral questions
        if (self.current_phase == InterviewPhase.BEHAVIORAL and
            interview_type == "dsa" and
            num_responses >= 2):
            
            self.current_phase = InterviewPhase.DSA_CODING
            logger.info("🔄 Transitioning to DSA phase")
            await self.send_phase_change(InterviewPhase.DSA_CODING)
        
        # End after 10-12 questions
        elif num_responses >= 10:
            self.current_phase = InterviewPhase.WRAP_UP
            logger.info("🔄 Entering wrap-up phase")
    
    async def _handle_skip_question(self):
        """Handle skipping current question"""
        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                return
            
            # Generate next question
            response = await self.interview_service.generate_follow_up(
                session_data.get("responses", []),
                session_data.get("interview_type", "behavioral")
            )
            
            await self._speak_response({"question": response, "type": "skipped"})
            
        except Exception as e:
            logger.error(f"Skip question error: {e}", exc_info=True)
    
    async def _end_interview(self):
        """End interview and generate feedback"""
        try:
            self.current_phase = InterviewPhase.ENDED
            
            await self.send_status("generating_feedback")
            
            # Get session data
            session_data = await get_session(self.session_key)
            if not session_data:
                await self.send_error("Session not found")
                return
            
            # Calculate duration
            started_at = datetime.fromisoformat(session_data["started_at"])
            duration = (datetime.now(timezone.utc) - started_at).total_seconds() / 60
            
            # Generate feedback
            feedback_data = {
                "interview_type": session_data.get("interview_type"),
                "custom_role": session_data.get("custom_role"),
                "duration": int(duration),
                "responses": session_data.get("responses", []),
                "code_submissions": session_data.get("code_submissions", [])
            }
            
            feedback = await self.interview_service.generate_final_feedback(feedback_data)
            
            # Update session
            session_data["status"] = "completed"
            session_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            await update_session(self.session_key, session_data)
            
            # Send feedback
            await self.send_feedback(feedback)
            
            logger.info(f"✅ Interview completed: {self.session_id}")
            
        except Exception as e:
            logger.error(f"End interview error: {e}", exc_info=True)
            await self.send_error("Failed to end interview")
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeats"""
        try:
            while True:
                await asyncio.sleep(30)
                await self.send_message({"type": "heartbeat"})
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")
    
    async def _timeout_monitor(self):
        """Monitor for activity timeout"""
        try:
            while True:
                await asyncio.sleep(60)
                
                inactive_seconds = (datetime.now(timezone.utc) - self.last_activity).total_seconds()
                
                if inactive_seconds > self.connection_timeout:
                    logger.warning(f"Connection timeout for session {self.session_id}")
                    await self.send_error("Connection timeout due to inactivity")
                    break
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Timeout monitor error: {e}")
    
    # WebSocket message senders
    
    async def send_question(self, question: Dict[str, Any], audio: bytes):
        """Send question with audio"""
        message = {
            "type": "question",
            "question": question,
            "phase": self.current_phase.value,
            "audio": base64.b64encode(audio).decode("utf-8"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
    
    async def send_transcript(self, text: str, is_final: bool):
        """Send transcript update"""
        message = {
            "type": "transcript",
            "text": text,
            "is_final": is_final,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
    
    async def send_status(self, status: str):
        """Send status update"""
        message = {
            "type": "status",
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
    
    async def send_phase_change(self, phase: InterviewPhase):
        """Send phase change notification"""
        message = {
            "type": "phase_change",
            "phase": phase.value,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
    
    async def send_feedback(self, feedback: Dict[str, Any]):
        """Send final feedback"""
        message = {
            "type": "feedback",
            "feedback": feedback,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
    
    async def send_error(self, error_message: str):
        """Send error message"""
        message = {
            "type": "error",
            "message": error_message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send_message(message)
    
    async def send_message(self, message: Dict[str, Any]):
        """Send message with error handling"""
        try:
            await self.websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
    
    async def cleanup(self):
        """Cleanup resources"""
        logger.info(f"🧹 Cleaning up session: {self.session_id}")
        
        # Cancel background tasks
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
        if self.timeout_task:
            self.timeout_task.cancel()
        
        # Close STT connection
        if self.stt_service:
            await self.stt_service.close()
        
        # Clear cache
        self.tts_cache.clear()
        
        # Clear buffers
        self.audio_buffer.clear()
        self.current_transcript.clear()