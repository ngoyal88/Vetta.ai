"""LiveKit interview agent (disabled for WebSocket-only MVP).

This repo previously shipped a LiveKit-based voice agent. The currently installed
`livekit-agents` version in this workspace does not provide the legacy
`livekit.agents.pipeline` module that this file originally depended on.

For the MVP deployment we run the WebSocket + Deepgram + ElevenLabs path.
We keep this file as a placeholder for later LiveKit re-integration.
"""

from __future__ import annotations

import asyncio
from typing import Optional
import os
from datetime import datetime, timezone

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.plugins import deepgram, elevenlabs, openai

from services.interview_service import InterviewService
import json
from services.gemini_service import GeminiService
from config import get_settings
from utils.redis_client import get_session, update_session
from utils.logger import get_logger
from config import get_settings
from models.interview import InterviewType, DifficultyLevel

logger = get_logger("LiveKitInterviewAgent")
settings = get_settings()


class InterviewAgent:
    """LiveKit Voice Agent for conducting interviews"""
    
    def __init__(self, ctx: JobContext):
        self.ctx = ctx
        self.room = ctx.room
        self.session_id = ctx.room.name
        self.interview_service = InterviewService()
        # Only initialize Gemini if selected; agent doesn't need direct LLM otherwise
        try:
            if (settings.llm_provider or "gemini").lower() == "gemini" and settings.llm_api_key:
                self.gemini_service = GeminiService()
            else:
                self.gemini_service = None
        except Exception:
            self.gemini_service = None
        self.agent: Optional[object] = None
        self.current_phase = "greeting"
        self.processing_response = False
        # Ensure plugin API keys are available as environment variables
        try:
            if settings.deepgram_api_key and not os.getenv("DEEPGRAM_API_KEY"):
                os.environ["DEEPGRAM_API_KEY"] = settings.deepgram_api_key
            # Some environments expect ELEVEN_API_KEY, others ELEVENLABS_API_KEY
            if settings.elevenlabs_api_key:
                if not os.getenv("ELEVEN_API_KEY"):
                    os.environ["ELEVEN_API_KEY"] = settings.elevenlabs_api_key
                if not os.getenv("ELEVENLABS_API_KEY"):
                    os.environ["ELEVENLABS_API_KEY"] = settings.elevenlabs_api_key
        except Exception:
            pass
        
    async def entrypoint(self):
        """Main entry point for the agent"""
        raise RuntimeError(
            "LiveKit agent is disabled in WebSocket-only MVP. "
            "Re-implement this agent against the currently installed livekit-agents API "
            "before enabling LiveKit again."
        )

        try:
            logger.info(f"🤖 Agent starting for session: {self.session_id}")
            
            # Load session data
            session_data = await get_session(f"interview:{self.session_id}")
            if not session_data:
                logger.error(f"Session not found: {self.session_id}")
                return
            
            # Configure STT (Deepgram)
            stt = deepgram.STT(
                model="nova-2",
                language="en"
            )
            
            # Configure TTS (ElevenLabs or OpenAI)
        
            tts = elevenlabs.TTS(
                voice="adam",  # Professional male voice
                model="eleven_flash_v2"
            )

            # Create LLM adapter for interview logic
            llm_adapter = InterviewLLM(
                session_id=self.session_id,
                interview_service=self.interview_service,
                gemini_service=self.gemini_service,
                room=self.room
            )
            
            # LiveKit agent pipeline intentionally disabled for MVP.
            self.agent = None
            
            # Start the agent
            self.agent.start(self.room)
            
            # Wait for participant to join
            logger.info("⏳ Waiting for participant...")
            participant = await self.wait_for_participant()
            
            if not participant:
                logger.error("No participant joined")
                return
            
            logger.info(f"✅ Participant joined: {participant.identity}")
            
            # Send greeting
            await self.send_greeting(session_data)
            
            # Keep agent alive
            await asyncio.sleep(settings.max_interview_duration_minutes * 60)
            
        except Exception as e:
            logger.error(f"Agent error: {e}", exc_info=True)
        finally:
            logger.info("🛑 Agent shutting down")
    
    async def wait_for_participant(self, timeout: int = 60) -> Optional[rtc.RemoteParticipant]:
        """Wait for a participant to join the room"""
        try:
            # Check if participant already in room
            participants = list(self.room.remote_participants.values())
            if participants:
                return participants[0]
            
            # Wait for participant to join
            future = asyncio.Future()
            
            def on_participant_connected(participant: rtc.RemoteParticipant):
                if not future.done():
                    future.set_result(participant)
            
            self.room.on("participant_connected", on_participant_connected)
            
            participant = await asyncio.wait_for(future, timeout=timeout)
            return participant
            
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for participant")
            return None
        except Exception as e:
            logger.error(f"Error waiting for participant: {e}")
            return None
    
    async def send_greeting(self, session_data: dict):
        """Send initial greeting"""
        try:
            user_name = session_data.get("user_id", "Candidate")
            interview_type = session_data.get("interview_type", "technical")
            custom_role = session_data.get("custom_role")
            role = custom_role or interview_type
            
            greeting = await self.interview_service.generate_greeting(user_name, role)
            
            # Speak the greeting
            await self.agent.say(greeting)
            
            logger.info("✅ Greeting sent")
            
            # Brief pause before first question
            await asyncio.sleep(2)
            
            # Get and ask first question
            questions = session_data.get("questions", [])
            if questions:
                first_q = questions[0]
                question_text = self._extract_question_text(first_q)
                await self.agent.say(question_text)
                # Publish data message so frontend can render question panel
                try:
                    payload = json.dumps({
                        "type": "question",
                        "question": first_q,
                        "phase": "behavioral"
                    }).encode("utf-8")
                    # Best-effort publish; ignore failure
                    self.room.local_participant.publish_data(payload, reliable=True)
                except Exception as e:
                    logger.warning(f"Failed to publish question data: {e}")
                
        except Exception as e:
            logger.error(f"Error sending greeting: {e}", exc_info=True)
    
    def _extract_question_text(self, question_entry) -> str:
        """Extract speakable text from question"""
        if isinstance(question_entry, str):
            return question_entry
        
        if isinstance(question_entry, dict):
            # Get question field
            q = question_entry.get("question", question_entry)
            
            if isinstance(q, dict):
                # DSA question - speak only title and brief description
                if q.get("type") == "coding":
                    title = q.get("title", "")
                    desc = q.get("description", "")
                    return f"{title}. {desc[:200]}..."
                
                # Regular question
                return q.get("question", "")
            elif isinstance(q, str):
                return q
        
        return str(question_entry)


class InterviewLLM(llm.LLM):
    """Custom LLM adapter for interview logic"""
    
    def __init__(
        self,
        session_id: str,
        interview_service: InterviewService,
        gemini_service: GeminiService,
        room: rtc.Room
    ):
        self.session_id = session_id
        self.interview_service = interview_service
        self.gemini_service = gemini_service
        self.room = room
    
    async def chat(
        self,
        chat_ctx: llm.ChatContext,
        **kwargs
    ) -> llm.LLMStream:
        """Process user's speech and generate response"""
        try:
            # Get user's last message
            user_message = chat_ctx.messages[-1].content if chat_ctx.messages else ""
            
            logger.info(f"📝 Processing user response: {user_message[:100]}...")
            
            # Process answer and generate follow-up
            response = await self.interview_service.process_answer_and_generate_followup(
                self.session_id,
                user_message
            )
            
            # Extract question text
            question_text = self._extract_question_text(response)
            
            # Publish data message for UI (question panel)
            try:
                payload = json.dumps({
                    "type": "question",
                    "question": response,
                    "phase": response.get("type", "behavioral")
                }).encode("utf-8")
                self.room.local_participant.publish_data(payload, reliable=True)
            except Exception as e:
                logger.warning(f"Failed to publish follow-up data: {e}")

            # Create LLM stream
            stream = llm.LLMStream()
            
            # Simulate streaming response
            async def _generate():
                yield llm.ChatChunk(
                    choices=[
                        llm.Choice(
                            delta=llm.ChoiceDelta(
                                content=question_text,
                                role="assistant"
                            )
                        )
                    ]
                )
            
            stream._generator = _generate()
            return stream
            
        except Exception as e:
            logger.error(f"Error in chat: {e}", exc_info=True)
            
            # Return error message
            stream = llm.LLMStream()
            async def _error():
                yield llm.ChatChunk(
                    choices=[
                        llm.Choice(
                            delta=llm.ChoiceDelta(
                                content="I encountered an error. Could you please repeat that?",
                                role="assistant"
                            )
                        )
                    ]
                )
            stream._generator = _error()
            return stream
    
    def _extract_question_text(self, response) -> str:
        """Extract speakable text from response"""
        if isinstance(response, str):
            return response
        
        if isinstance(response, dict):
            q = response.get("question")
            if isinstance(q, dict):
                if q.get("type") == "coding":
                    title = q.get("title", "")
                    desc = q.get("description", "")
                    return f"{title}. {desc[:200]}..."
                return q.get("question", "")
            elif isinstance(q, str):
                return q
        
        return str(response)


# Worker entry point
async def entrypoint(ctx: JobContext):
    """Entry point for LiveKit agent worker"""
    agent = InterviewAgent(ctx)
    await agent.entrypoint()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
            ws_url=settings.livekit_url,
        )
    )