"""
Pipecat Pipeline for AI Interviewer
Handles real-time voice conversation flow
"""

import asyncio
import os
from typing import AsyncGenerator

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.frames.frames import (
    Frame, TextFrame, EndFrame, LLMMessagesFrame, 
    UserStartedSpeakingFrame, UserStoppedSpeakingFrame
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.aggregators.openai_llm_context import (
    OpenAILLMContext,
    OpenAILLMContextFrame
)
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.transports.services.livekit import LiveKitTransport, LiveKitParams

from livekit import api

from services.gemini_service import GeminiService
from services.interview_service import InterviewService
from utils.redis_client import get_session, update_session
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
        self.is_greeting_sent = False
        self.current_transcript = ""
        
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process frames flowing through the pipeline"""
        
        # Handle user speech transcription
        if isinstance(frame, TextFrame) and direction == FrameDirection.UPSTREAM:
            await self._handle_user_speech(frame.text)
            # Pass frame along
            await self.push_frame(frame, direction)
            
        # Handle speech start/stop for VAD
        elif isinstance(frame, UserStartedSpeakingFrame):
            logger.info("🎤 User started speaking")
            await self.push_frame(frame, direction)
            
        elif isinstance(frame, UserStoppedSpeakingFrame):
            logger.info("🔇 User stopped speaking")
            await self._process_user_turn()
            
        else:
            # Pass through other frames
            await self.push_frame(frame, direction)
    
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
            # Get session data
            session_data = await get_session(f"interview:{self.session_id}")
            if not session_data:
                logger.error("Session not found")
                return
            
            # Build context
            context = self._build_context(session_data, user_message)
            
            # Generate AI response via Gemini
            prompt = f"""You are conducting a {session_data.get('interview_type', 'technical')} interview.

{context}

Candidate just said: "{user_message}"

As the interviewer:
1. Acknowledge their answer briefly (1 sentence)
2. Either ask a follow-up question OR move to next topic
3. Be conversational, encouraging, and professional
4. Keep response under 60 words

Your response:"""
            
            ai_response = await self.gemini.generate_text(prompt, temperature=0.8)
            
            # Store in session
            session_data.setdefault('responses', []).append({
                'user': user_message,
                'ai': ai_response,
                'timestamp': asyncio.get_event_loop().time()
            })
            await update_session(f"interview:{self.session_id}", session_data)
            
            logger.info(f"AI Response: {ai_response}")
            
            # Send AI response to TTS pipeline
            await self.push_frame(TextFrame(ai_response), FrameDirection.DOWNSTREAM)
            
        except Exception as e:
            logger.error(f"Error processing user turn: {e}", exc_info=True)
    
    def _build_context(self, session_data: dict, user_message: str) -> str:
        """Build context for LLM"""
        
        context_parts = []
        
        # Interview type
        interview_type = session_data.get('interview_type', 'general')
        context_parts.append(f"Interview Type: {interview_type}")
        
        # Custom role if applicable
        if session_data.get('custom_role'):
            context_parts.append(f"Target Role: {session_data['custom_role']}")
        
        # Recent conversation history
        responses = session_data.get('responses', [])
        if responses:
            context_parts.append("\nRecent conversation:")
            for resp in responses[-3:]:  # Last 3 exchanges
                context_parts.append(f"AI: {resp.get('ai', '')}")
                context_parts.append(f"Candidate: {resp.get('user', '')}")
        
        # Current question if exists
        questions = session_data.get('questions', [])
        if questions:
            current_q = questions[-1]
            context_parts.append(f"\nCurrent Question: {current_q.get('question', '')}")
        
        return "\n".join(context_parts)


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
            
            # 2. Create LiveKit transport
            transport = LiveKitTransport(
                url=settings.livekit_url,
                token=token,
                params=LiveKitParams(
                    audio_in_enabled=True,
                    audio_out_enabled=True,
                    video_out_enabled=False,
                    transcription_enabled=False  # We handle STT ourselves
                )
            )
            
            # 3. Speech-to-Text service (Deepgram - best quality/speed)
            stt = DeepgramSTTService(
                api_key=settings.deepgram_api_key,
                model="nova-2-general",
                language="en-US"
            )
            
            # 4. Custom interview processor (Gemini logic)
            interview_processor = InterviewProcessor(self.session_id)
            
            # 5. Text-to-Speech service (ElevenLabs - most natural)
            tts = ElevenLabsTTSService(
                api_key=settings.elevenlabs_api_key,
                voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel voice (professional)
                model="eleven_turbo_v2"  # Fastest model
            )
            
            # 6. Build pipeline
            pipeline = Pipeline([
                transport.input(),      # User audio from LiveKit
                stt,                    # → Transcribed text
                interview_processor,    # → Process with Gemini
                tts,                    # → AI voice audio
                transport.output()      # → Back to LiveKit room
            ])
            
            # 7. Create task
            task = PipelineTask(
                pipeline,
                params=PipelineParams(
                    allow_interruptions=True,  # User can interrupt AI
                    enable_metrics=True,
                    enable_usage_metrics=True
                )
            )
            
            # 8. Send greeting message
            await self._send_greeting(task)
            
            # 9. Run pipeline (blocks until interview ends)
            runner = PipelineRunner()
            await runner.run(task)
            
            logger.info(f"✅ Pipeline finished for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
            raise
    
    async def _send_greeting(self, task: PipelineTask):
        """Send initial greeting to candidate"""
        
        try:
            # Get session data
            session_data = await get_session(f"interview:{self.session_id}")
            if not session_data:
                greeting = "Hello! I'm your AI interviewer. Let's begin."
            else:
                user_name = session_data.get('user_id', 'Candidate')
                role = session_data.get('custom_role', 'Developer')
                greeting = await self.interview_service.generate_greeting(user_name, role)
            
            # Queue greeting in pipeline
            await task.queue_frames([TextFrame(greeting)])
            logger.info(f"Greeting sent: {greeting}")
            
        except Exception as e:
            logger.error(f"Failed to send greeting: {e}")
    
    def _generate_agent_token(self) -> str:
        """Generate LiveKit access token for the AI agent"""
        
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
    """Entry point to start a pipeline for a session"""
    
    room_name = f"interview-{session_id}"
    pipeline = InterviewPipeline(session_id, room_name)
    
    try:
        await pipeline.run()
    except Exception as e:
        logger.error(f"Pipeline failed for {session_id}: {e}", exc_info=True)


if __name__ == "__main__":
    """Run as standalone process"""
    
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python pipecat_pipeline.py <session_id>")
        sys.exit(1)
    
    session_id = sys.argv[1]
    asyncio.run(start_interview_pipeline(session_id))