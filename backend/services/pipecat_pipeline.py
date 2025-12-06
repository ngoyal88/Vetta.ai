# services/pipecat_pipeline.py
"""
Pipecat Pipeline for AI Interviewer
Handles real-time voice conversation flow
"""
import asyncio
import os
import sys
import json

# Fix path so imports from project root work when running file directly
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import get_settings
from utils.logger import get_logger
from utils.redis_client import get_session
from services.interview_service import InterviewService

# Pipecat imports
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.frames.frames import (
    Frame, TextFrame, UserStartedSpeakingFrame, UserStoppedSpeakingFrame, EndFrame
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.transports.livekit.transport import LiveKitTransport, LiveKitParams
from livekit import api

logger = get_logger("PipecatPipeline")
settings = get_settings()


def _speak_text_from_ai(ai_obj) -> str:
    """Extract string to send to TTS from AI response object."""
    if isinstance(ai_obj, str):
        return ai_obj
    if isinstance(ai_obj, dict):
        # prefer 'spoken' -> 'question' -> fallback to raw string
        return ai_obj.get("spoken") or (ai_obj.get("question") if isinstance(ai_obj.get("question"), str) else None) or json.dumps(ai_obj)
    return str(ai_obj)


class InterviewProcessor(FrameProcessor):
    """Custom processor that handles interview logic with InterviewService"""
    def __init__(self, session_id: str, transport: LiveKitTransport):
        super().__init__()
        self.session_id = session_id
        self.transport = transport
        self.interview_service = InterviewService()
        self.current_transcript = []  # list of text chunks
        self._lock = asyncio.Lock()
        self.processing = False

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process frames flowing through the pipeline"""
        # 1. Handle User Speech (Text from STT)
        if isinstance(frame, TextFrame) and direction == FrameDirection.UPSTREAM:
            async with self._lock:
                self.current_transcript.append(frame.text)
            logger.debug(f"Transcript chunk: {frame.text}")
            await self.push_frame(frame, direction)
            return

        # 2. Handle VAD Events
        if isinstance(frame, UserStartedSpeakingFrame):
            logger.debug("User started speaking")
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, UserStoppedSpeakingFrame):
            logger.debug("User stopped speaking")
            await self.push_frame(frame, direction)
            # process user turn in background
            asyncio.create_task(self._process_user_turn())
            return

        # 3. Pass through other frames
        await super().process_frame(frame, direction)

    async def _process_user_turn(self):
        """Process complete user utterance"""
        # Prevent concurrent processing of multiple user turns
        async with self._lock:
            if self.processing:
                logger.debug("Already processing a user turn, skipping")
                return
            if not self.current_transcript:
                return
            self.processing = True
            user_message = " ".join(self.current_transcript).strip()
            self.current_transcript = []

        if not user_message:
            async with self._lock:
                self.processing = False
            return

        try:
            logger.info(f"Processing user message: {user_message[:200]}...")
            ai_response = await self.interview_service.process_answer_and_generate_followup(self.session_id, user_message)
            logger.info(f"AI generated: {str(ai_response)[:200]}")

            # 1) Send structured update to UI
            await self._send_question_to_ui(ai_response)

            # 2) Send speakable text to downstream (TTS)
            speak_text = _speak_text_from_ai(ai_response)
            if speak_text:
                await self.push_frame(TextFrame(speak_text), FrameDirection.DOWNSTREAM)
                logger.debug("Queued TTS frame downstream")

        except Exception as e:
            logger.error(f"Error processing user turn: {e}", exc_info=True)
        finally:
            async with self._lock:
                self.processing = False

    async def _send_question_to_ui(self, question_data):
        """Send question update to React UI via LiveKit data channel"""
        try:
            # Normalize payload
            if isinstance(question_data, dict) and "type" in question_data:
                phase = "dsa" if question_data.get("type") == "coding" else "behavioral"
                q_payload = question_data.get("question", question_data)
            else:
                phase = "behavioral"
                q_payload = question_data

            payload = {
                "type": "question_update",
                "question": q_payload,
                "phase": phase
            }

            if hasattr(self.transport, "send_data"):
                # include topic param if supported
                try:
                    await self.transport.send_data(json.dumps(payload).encode("utf-8"), topic="interview-updates")
                except TypeError:
                    # older transport impl might not accept topic keyword
                    await self.transport.send_data(json.dumps(payload).encode("utf-8"))
            else:
                logger.warning("Transport has no send_data method; skipping UI update.")
        except Exception as e:
            logger.warning(f"Failed to send UI update (non-fatal): {e}", exc_info=True)


class InterviewPipeline:
    def __init__(self, session_id: str, room_name: str):
        self.session_id = session_id
        self.room_name = room_name
        self.interview_service = InterviewService()
        self.task = None
        self.transport = None
        self._stopped = False

    async def run(self):
        logger.info(f"Starting pipeline: {self.session_id}")

        # Basic validations
        if not (settings.deepgram_api_key and settings.elevenlabs_api_key and settings.livekit_api_key and settings.livekit_api_secret and settings.livekit_url):
            logger.error("Missing required API keys / LiveKit URL")
            return

        try:
            token = self._generate_agent_token()

            # VAD
            vad = SileroVADAnalyzer(params=VADParams(start_secs=0.5, stop_secs=0.8, confidence=0.5))

            # Transport
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
            self.transport = transport

            # Services
            stt = DeepgramSTTService(api_key=settings.deepgram_api_key)
            tts = ElevenLabsTTSService(api_key=settings.elevenlabs_api_key, voice_id="21m00Tcm4TlvDq8ikWAM")

            processor = InterviewProcessor(self.session_id, transport)

            pipeline = Pipeline([
                transport.input(),
                stt,
                processor,
                tts,
                transport.output()
            ])

            self.task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True, enable_metrics=True))

            # queue greeting + first question after task created
            asyncio.create_task(self._send_initial_content(self.task, transport))

            logger.info("Running pipeline runner...")
            runner = PipelineRunner()
            await runner.run(self.task)
            logger.info("Pipeline runner finished")

        except Exception as e:
            logger.error(f"Pipeline crashed: {e}", exc_info=True)
        finally:
            # cleanup resources if transport provides close methods
            try:
                if hasattr(self.transport, "close"):
                    await self.transport.close()
            except Exception:
                pass

    async def _send_initial_content(self, task: PipelineTask, transport: LiveKitTransport):
        try:
            await asyncio.sleep(1.5)  # small delay to let runner spin up

            session_data = await get_session(f"interview:{self.session_id}")

            if not session_data:
                logger.warning("Session data not found, using defaults")
                greeting = "Hello! I am your AI interviewer. Let's begin."
                first_question = {"question": "Tell me about yourself.", "type": "behavioral", "timestamp": datetime.now(timezone.utc).isoformat()}
            else:
                user_name = session_data.get('user_id', 'Candidate')
                role = session_data.get('custom_role') or session_data.get('interview_type', 'role')
                greeting = await self.interview_service.generate_greeting(user_name, role)
                questions = session_data.get('questions', [])
                first_question = questions[0] if questions else {"question": "Tell me about yourself.", "type": "behavioral", "timestamp": datetime.now(timezone.utc).isoformat()}

            # send greeting to be spoken
            await task.queue_frames([TextFrame(greeting)])

            # small pause to avoid overlap
            await asyncio.sleep(1)

            # send UI update with first question
            is_coding = isinstance(first_question, dict) and (first_question.get("type") == "coding" or (isinstance(first_question.get("question"), dict) and first_question.get("question").get("type") == "coding"))
            phase = "dsa" if is_coding else "behavioral"
            payload = {
                "type": "question_update",
                "question": first_question.get("question") if isinstance(first_question, dict) else first_question,
                "phase": phase
            }

            if hasattr(transport, "send_data"):
                try:
                    await transport.send_data(json.dumps(payload).encode("utf-8"), topic="interview-updates")
                except TypeError:
                    await transport.send_data(json.dumps(payload).encode("utf-8"))

            # optionally queue the question to be spoken too (if simple string)
            speakable = None
            if isinstance(first_question, dict):
                q = first_question.get("question")
                if isinstance(q, str):
                    speakable = q
            elif isinstance(first_question, str):
                speakable = first_question

            if speakable:
                await task.queue_frames([TextFrame(speakable)])

        except Exception as e:
            logger.error(f"Failed to send initial content: {e}", exc_info=True)

    def _generate_agent_token(self) -> str:
        token = api.AccessToken(api_key=settings.livekit_api_key, api_secret=settings.livekit_api_secret)
        token.with_identity(f"agent-{self.session_id}")
        token.with_name("AI Interviewer")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=self.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        ))
        return token.to_jwt()


async def start_interview_pipeline(session_id: str):
    pipeline = InterviewPipeline(session_id, f"interview-{session_id}")
    await pipeline.run()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pipecat_pipeline.py <session_id>")
        sys.exit(1)

    # Configure logs for this subprocess
    from utils.logger import setup_logging
    setup_logging()

    asyncio.run(start_interview_pipeline(sys.argv[1]))
