# ========================================
# 8. routes/websocket_interview.py - WebSocket for real-time
# ========================================

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import base64
import io
import wave
from typing import Dict, List
from utils.logger import get_logger
from datetime import datetime, timezone
from utils.redis_client import create_session, get_session, update_session
from services.interview_service import interview_service 
from services.transcription_service import TranscriptionService
from services.tts_service import TTSService
from routes.interview_session import InterviewSession 

from config import get_settings

router = APIRouter()
logger = get_logger("WebSocketInterview")

# Initialize AI Services
stt_service = TranscriptionService()
tts_service = TTSService()

# Active connections
active_connections: Dict[str, WebSocket] = {}

@router.websocket("/ws/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    """WebSocket for real-time interview communication."""
    await websocket.accept()
    
    # --- AUTH CHECK (Relaxed for Development) ---
    settings = get_settings()
    token = websocket.query_params.get("token")
    if settings.api_token and token != f"Bearer {settings.api_token}":
        logger.warning(f"⚠️ WebSocket connected without valid token: {session_id}")

    active_connections[session_id] = websocket
    logger.info(f"WebSocket connected: {session_id}")
    
    # --- AUDIO BUFFERING STATE ---
    audio_buffer = bytearray()
    header_chunk = None  # CRITICAL: Caches the WebM header to fix Whisper crash
    BUFFER_THRESHOLD = 16000  # Reduced to ~0.5s for faster response
    
    try:
        # 1. Send Connected Signal
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "message": "WebSocket connected successfully"
        })

        # 2. IMMEDIATE GREETING (Fixes "No Intro" issue)
        try:
            session_data = await get_session(f"interview:{session_id}")
            user_name = session_data.get("user_id", "Candidate") if session_data else "Candidate"
            role = session_data.get("custom_role", "Developer") if session_data else "Developer"
            
            greeting_text = await interview_service.generate_greeting(user_name, role)
            audio_b64 = await tts_service.speak(greeting_text)
            
            await websocket.send_json({
                "type": "ai_response",
                "text": greeting_text,
                "audio": audio_b64
            })
        except Exception as e:
            logger.error(f"Failed to generate greeting: {e}")

        
        while True:
            # Receive message
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue
            
            msg_type = message.get("type")
            
            # --- HANDLE MESSAGES ---
            
            if msg_type == "audio_chunk":
                audio_base64 = message.get("audio", "")
                if audio_base64:
                    chunk = base64.b64decode(audio_base64)
                    
                    # 1. Capture Header (First Chunk)
                    if header_chunk is None:
                        header_chunk = chunk
                    
                    audio_buffer.extend(chunk)
                    
                    # 2. Process only when buffer is full
                    if len(audio_buffer) > BUFFER_THRESHOLD:
                        full_audio_data = bytes(audio_buffer)
                        
                        # 3. Re-inject header if missing (Critical for Whisper)
                        if header_chunk and not full_audio_data.startswith(header_chunk[:10]):
                             full_audio_data = header_chunk + full_audio_data

                        transcription = await stt_service.transcribe_audio_bytes(full_audio_data)
                        
                        # 4. Clear buffer but keep header_chunk variable
                        del audio_buffer[:] 
                        
                        if transcription and len(transcription.strip()) > 1:
                            await websocket.send_json({
                                "type": "transcription",
                                "speaker": "candidate",
                                "text": transcription,
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            })
            
            elif msg_type == "answer_commit":
                # User finished speaking -> Generate AI Response
                user_text = message.get("text")
                if user_text:
                    logger.info(f"User Answer: {user_text}")
                    ai_text = await interview_service.process_answer_and_generate_followup(session_id, user_text)
                    
                    # Generate Audio
                    audio_b64 = await tts_service.speak(ai_text)
                    
                    await websocket.send_json({
                        "type": "ai_response",
                        "text": ai_text,
                        "audio": audio_b64
                    })
            
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
        if session_id in active_connections:
            del active_connections[session_id]
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        if session_id in active_connections:
            del active_connections[session_id]

async def handle_audio_chunk(websocket: WebSocket, session_id: str, message: dict, audio_buffer: bytearray):
    """Handle live audio chunk.

    EXPECTED INPUT (frontend change required): base64 of raw PCM16 mono 16kHz.
    We accumulate ~2s then wrap as WAV for Whisper.
    """
    try:
        audio_base64 = message.get("audio", "")
        speaker = message.get("speaker", "candidate")
        if not audio_base64:
            return

        # Decode raw PCM16 chunk and extend buffer
        try:
            chunk = base64.b64decode(audio_base64)
        except Exception:
            await websocket.send_json({"type": "error", "message": "Bad audio base64"})
            return
        audio_buffer.extend(chunk)

        # Threshold: ~2 seconds (16000 samples/sec * 2 * 2 bytes ≈ 64000)
        BUFFER_THRESHOLD = 64000
        if len(audio_buffer) < BUFFER_THRESHOLD:
            return

        # Wrap raw PCM into a WAV container in memory for Whisper
        wav_bytes_io = io.BytesIO()
        with wave.open(wav_bytes_io, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(16000)
            wf.writeframes(bytes(audio_buffer))
        wav_bytes = wav_bytes_io.getvalue()
        del audio_buffer[:]  # clear buffer after packaging

        transcription = await stt_service.transcribe_audio_bytes(wav_bytes)
        if not transcription:
            return

        # Send transcription back
        payload = {
            "type": "transcription",
            "speaker": speaker,
            "text": transcription,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await websocket.send_json(payload)

        # Persist transcription
        session_data = await get_session(f"interview:{session_id}")
        if session_data:
            session = InterviewSession(**session_data)
            session.live_transcription.append(payload)
            await update_session(f"interview:{session_id}", session.dict())

    except Exception as e:
        logger.error(f"Error handling audio chunk: {e}", exc_info=True)
        if len(audio_buffer) > 1_000_000:  # safety cap
            del audio_buffer[:]


async def handle_request_question(websocket: WebSocket, session_id: str, message: dict):
    """Handle request for next question with TTS"""
    try:
        session_data = await get_session(f"interview:{session_id}")
        if not session_data:
            await websocket.send_json({
                "type": "error",
                "message": "Session not found"
            })
            return
        
        session = InterviewSession(**session_data)
        question_text = ""
        
        # Get current or next question
        if session.current_question_index < len(session.questions):
            question = session.questions[session.current_question_index]
            question_text = question.get('question', '')
        else:
            # Generate new question via LLM
            question_text = await interview_service.generate_follow_up(
                session.responses,
                session.interview_type
            )
            question = {
                'question': question_text,
                'type': session.interview_type.value,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            session.questions.append(question)
            await update_session(f"interview:{session_id}", session.dict())
        
        # 🗣️ Generate Audio (TTS) for the question
        audio_b64 = await tts_service.speak(question_text)

        await websocket.send_json({
            "type": "question",
            "question": question,
            "question_index": session.current_question_index,
            "audio": audio_b64  # Send audio to frontend
        })
        
    except Exception as e:
        logger.error(f"Error requesting question: {e}", exc_info=True)
        await websocket.send_json({
            "type": "error",
            "message": "Failed to get question"
        })


async def handle_submit_response(websocket: WebSocket, session_id: str, message: dict):
    """Handle response submission via WebSocket"""
    try:
        response_text = message.get("response", "")
        question_index = message.get("question_index", 0)
        
        session_data = await get_session(f"interview:{session_id}")
        if not session_data:
            await websocket.send_json({
                "type": "error",
                "message": "Session not found"
            })
            return
        
        session = InterviewSession(**session_data)
        
        if question_index >= len(session.questions):
            await websocket.send_json({
                "type": "error",
                "message": "Invalid question index"
            })
            return
        
        current_question = session.questions[question_index]
        
        # Analyze response
        analysis = await interview_service.analyze_response(
            current_question.get('question', ''),
            response_text,
            session.interview_type
        )
        
        # Store response
        session.responses.append({
            'question_index': question_index,
            'question': current_question,
            'response': response_text,
            'analysis': analysis,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
        session.current_question_index += 1
        await update_session(f"interview:{session_id}", session.dict())
        
        # Send acknowledgment with analysis
        await websocket.send_json({
            "type": "response_received",
            "analysis": analysis,
            "question_index": question_index
        })
        
    except Exception as e:
        logger.error(f"Error submitting response: {e}", exc_info=True)
        await websocket.send_json({
            "type": "error",
            "message": "Failed to submit response"
        })