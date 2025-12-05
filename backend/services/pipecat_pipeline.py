"""
Pipecat Pipeline for AI Interviewer
Handles real-time voice conversation flow
"""

import asyncio
import os
import sys
import json

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.frames.frames import (
    Frame, TextFrame, UserStartedSpeakingFrame, UserStoppedSpeakingFrame
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

# --- UPDATED IMPORTS FOR PIPECAT 0.0.96 ---
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.transports.livekit.transport import LiveKitTransport, LiveKitParams
# ------------------------------------------

from livekit import api

# Ensure package imports work when run as a script (python services/pipecat_pipeline.py)
FILE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(FILE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from services.gemini_service import GeminiService
from services.interview_service import InterviewService
from utils.redis_client import get_session
from utils.logger import get_logger
from config import get_settings

logger = get_logger("PipecatPipeline")
settings = get_settings()


class InterviewProcessor(FrameProcessor):
    """Custom processor that handles interview logic with Gemini"""
    
    def __init__(self, session_id: str, transport: LiveKitTransport):
        super().__init__()
        self.session_id = session_id
        self.transport = transport  # ✅ ADDED: Store transport reference
        self.gemini = GeminiService()
        self.interview_service = InterviewService()
        self.current_transcript = ""
        
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process frames flowing through the pipeline"""
        
        # 1. Handle User Speech (Text from STT)
        if isinstance(frame, TextFrame) and direction == FrameDirection.UPSTREAM:
            await self._handle_user_speech(frame.text)
            await self.push_frame(frame, direction)
            
        # 2. Handle VAD Events (Start/Stop Speaking)
        elif isinstance(frame, UserStartedSpeakingFrame):
            logger.info("🎤 User started speaking")
            await self.push_frame(frame, direction)
            
        elif isinstance(frame, UserStoppedSpeakingFrame):
            logger.info("🔇 User stopped speaking")
            await self.push_frame(frame, direction)
            await self._process_user_turn()
            
        # 3. Delegate system frames to base class
        else:
            await super().process_frame(frame, direction)
    
    async def _handle_user_speech(self, text: str):
        """Accumulate user's speech"""
        self.current_transcript += " " + text
        logger.info(f"User transcript: {self.current_transcript}")
    
    async def _process_user_turn(self):
        """Process complete user utterance and generate AI response"""
        
        if not self.current_transcript.strip():
            return
        
        user_message = self.current_transcript.strip()
        self.current_transcript = ""
        
        try:
            logger.info(f"Processing turn for message: {user_message}")
            
            # Get AI response
            ai_response = await self.interview_service.process_answer_and_generate_followup(
                self.session_id, 
                user_message
            )
            
            logger.info(f"AI Response: {ai_response[:100]}...")
            
            # ✅ FIX #1: Send question to React via LiveKit data channel
            await self._send_question_to_ui(ai_response)
            
            # Send AI response to TTS pipeline (for voice)
            await self.push_frame(TextFrame(ai_response), FrameDirection.DOWNSTREAM)
            
        except Exception as e:
            logger.error(f"Error processing user turn: {e}", exc_info=True)
    
    async def _send_question_to_ui(self, question_data):
        """✅ NEW METHOD: Send question update to React UI"""
        try:
            # Prepare data payload
            if isinstance(question_data, dict):
                payload = {
                    "type": "question_update",
                    "question": question_data,
                    "phase": "dsa" if question_data.get("type") == "coding" else "behavioral"
                }
            else:
                payload = {
                    "type": "question_update", 
                    "question": question_data,
                    "phase": "behavioral"
                }
            
            # Send via LiveKit data channel if supported in this version
            if hasattr(self.transport, "send_data"):
                await self.transport.send_data(
                    json.dumps(payload).encode('utf-8'),
                    topic="interview-updates"
                )
                logger.info("✅ Question sent to UI via data channel")
            else:
                logger.warning("LiveKitTransport.send_data not available; skipping UI data channel update")
            
        except Exception as e:
            logger.error(f"Failed to send question to UI: {e}", exc_info=True)


class InterviewPipeline:
    """Main pipeline orchestrator"""
    
    def __init__(self, session_id: str, room_name: str):
        self.session_id = session_id
        self.room_name = room_name
        self.gemini = GeminiService()
        self.interview_service = InterviewService()
        
    async def run(self):
        """Start the interview pipeline"""
        
        logger.info(f"🚀 Starting pipeline for session {self.session_id}")

        try:
            # 1. Generate agent token for LiveKit
            token = self._generate_agent_token()

            # 2. Initialize VAD (Voice Activity Detection)
            vad = SileroVADAnalyzer(params=VADParams(
                start_secs=0.5,
                stop_secs=0.5,
                confidence=0.5
            ))

            # 3. Create LiveKit transport
            transport = LiveKitTransport(
                url=settings.livekit_url,
                token=token,
                room_name=self.room_name,
                params=LiveKitParams(
                    audio_in_enabled=True,
                    audio_out_enabled=True,
                    vad_analyzer=vad,
                    transcription_enabled=False
                )
            )

            # Early validation of keys AFTER transport so we can notify UI
            if not settings.deepgram_api_key or not settings.elevenlabs_api_key:
                missing = []
                if not settings.deepgram_api_key:
                    missing.append("Deepgram API key")
                if not settings.elevenlabs_api_key:
                    missing.append("ElevenLabs API key")
                msg = f"Missing configuration: {', '.join(missing)}. Voice features disabled."
                logger.error(f"❌ {msg}")
                try:
                    await transport.send_data(
                        json.dumps({
                            "type": "info",
                            "message": msg,
                            "phase": "behavioral"
                        }).encode('utf-8'),
                        topic="interview-updates"
                    )
                except Exception:
                    pass
                return

            # 4. Speech-to-Text service (Deepgram)
            stt = DeepgramSTTService(
                api_key=settings.deepgram_api_key,
                model="nova-2-general",
                language="en-US"
            )

            # 5. Custom interview processor (✅ Pass transport reference)
            interview_processor = InterviewProcessor(self.session_id, transport)
            
            # 6. Text-to-Speech service (ElevenLabs)
            tts = ElevenLabsTTSService(
                api_key=settings.elevenlabs_api_key,
                voice_id="21m00Tcm4TlvDq8ikWAM", # Rachel
                model="eleven_turbo_v2"
            )
            
            # 7. Build pipeline
            pipeline = Pipeline([
                transport.input(),
                stt,
                interview_processor,
                tts,
                transport.output()
            ])
            
            # 8. Create task
            task = PipelineTask(
                pipeline,
                params=PipelineParams(
                    allow_interruptions=True,
                    enable_metrics=True
                )
            )
            
            # 9. Send greeting AND first question
            await self._send_initial_content(task, transport)
            
            # 10. Run pipeline
            runner = PipelineRunner()
            await runner.run(task)
            
            logger.info(f"✅ Pipeline finished for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
            raise
    
    async def _send_initial_content(self, task: PipelineTask, transport: LiveKitTransport):
        """✅ FIXED: Send greeting + first question"""
        try:
            session_data = await get_session(f"interview:{self.session_id}")
            
            if not session_data:
                greeting = "Hello! I am your AI interviewer. Let's begin."
                first_question = "Tell me about yourself."
            else:
                # Generate greeting
                user_name = session_data.get('user_id', 'Candidate')
                role = session_data.get('custom_role') or session_data.get('interview_type', 'Developer')
                greeting = await self.interview_service.generate_greeting(user_name, role)
                
                # Get first question from session
                questions = session_data.get('questions', [])
                if questions:
                    first_question = questions[0]
                else:
                    first_question = "Tell me about yourself and your experience."

            # Send greeting as voice
            await task.queue_frames([TextFrame(greeting)])
            logger.info(f"Greeting queued: {greeting}")
            
            # ✅ Send first question to UI via data channel
            await asyncio.sleep(1)  # Small delay after greeting
            
            payload = {
                "type": "question_update",
                "question": first_question,
                "phase": "dsa" if isinstance(first_question, dict) and first_question.get("type") == "coding" else "behavioral"
            }
            
            if hasattr(transport, "send_data"):
                await transport.send_data(
                    json.dumps(payload).encode('utf-8'),
                    topic="interview-updates"
                )
                logger.info(f"✅ First question sent to UI")
            else:
                logger.warning("LiveKitTransport.send_data not available; skipping initial UI data channel update")
            
        except Exception as e:
            logger.error(f"Failed to send initial content: {e}", exc_info=True)
    
    def _generate_agent_token(self) -> str:
        """✅ FIXED: Added can_publish_data permission"""
        token = api.AccessToken(
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret
        )
        token.with_identity(f"agent-{self.session_id}")
        token.with_name("AI Interviewer")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=self.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True  # ✅ ADDED: Required for sending data to React
        ))
        return token.to_jwt()


async def start_interview_pipeline(session_id: str):
    room_name = f"interview-{session_id}"
    pipeline = InterviewPipeline(session_id, room_name)
    try:
        await pipeline.run()
    except Exception as e:
        logger.error(f"Pipeline failed for {session_id}: {e}", exc_info=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pipecat_pipeline.py <session_id>")
        sys.exit(1)
    
    session_id = sys.argv[1]
    asyncio.run(start_interview_pipeline(session_id))