"""
Pipecat Pipeline for AI Interviewer
Handles real-time voice conversation flow
"""

import asyncio
import os
import sys

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
    
    def __init__(self, session_id: str):
        super().__init__()
        self.session_id = session_id
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
            await self.push_frame(frame, direction) # Forward event downstream
            await self._process_user_turn()         # Generate AI response
            
        # 3. CRITICAL FIX: Delegate system frames (StartFrame, EndFrame, etc.) to base class
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
            
            # Logic: Use InterviewService to get the next question/response
            ai_response = await self.interview_service.process_answer_and_generate_followup(
                self.session_id, 
                user_message
            )
            
            logger.info(f"AI Response: {ai_response}")
            
            # Send AI response to TTS pipeline
            await self.push_frame(TextFrame(ai_response), FrameDirection.DOWNSTREAM)
            
        except Exception as e:
            logger.error(f"Error processing user turn: {e}", exc_info=True)


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
        
        # Validation
        if not settings.deepgram_api_key:
            logger.error("❌ Deepgram API key missing! STT will fail.")
            return
        if not settings.elevenlabs_api_key:
            logger.error("❌ ElevenLabs API key missing! TTS will fail.")
            return

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
                    vad_analyzer=vad,  # VAD attached here
                    transcription_enabled=False
                )
            )

            # 4. Speech-to-Text service (Deepgram)
            stt = DeepgramSTTService(
                api_key=settings.deepgram_api_key,
                model="nova-2-general",
                language="en-US"
            )

            # 5. Custom interview processor
            interview_processor = InterviewProcessor(self.session_id)
            
            # 6. Text-to-Speech service (ElevenLabs)
            tts = ElevenLabsTTSService(
                api_key=settings.elevenlabs_api_key,
                voice_id="21m00Tcm4TlvDq8ikWAM", # Rachel
                model="eleven_turbo_v2"
            )
            
            # 7. Build pipeline
            pipeline = Pipeline([
                transport.input(),      # User audio (VAD filtered)
                stt,                    # Transcribe audio to text
                interview_processor,    # Logic & AI generation
                tts,                    # Convert AI text to audio
                transport.output()      # Send audio back to user
            ])
            
            # 8. Create task
            task = PipelineTask(
                pipeline,
                params=PipelineParams(
                    allow_interruptions=True,
                    enable_metrics=True
                )
            )
            
            # 9. Send greeting message
            await self._send_greeting(task)
            
            # 10. Run pipeline
            runner = PipelineRunner()
            await runner.run(task)
            
            logger.info(f"✅ Pipeline finished for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
            raise
    
    async def _send_greeting(self, task: PipelineTask):
        """Send initial greeting to candidate"""
        try:
            session_data = await get_session(f"interview:{self.session_id}")
            
            if not session_data:
                greeting = "Hello! I am your AI interviewer. Let's begin."
            else:
                try:
                    user_name = session_data.get('user_id', 'Candidate')
                    role = session_data.get('custom_role', 'Developer')
                    greeting = await self.interview_service.generate_greeting(user_name, role)
                except Exception:
                    greeting = "Hello! I am ready to start your interview."

            await task.queue_frames([TextFrame(greeting)])
            logger.info(f"Greeting queued: {greeting}")
            
        except Exception as e:
            logger.error(f"Failed to send greeting: {e}")
    
    def _generate_agent_token(self) -> str:
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
            can_subscribe=True
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