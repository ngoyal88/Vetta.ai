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

# Initialize AI Services (Global to avoid reloading models per connection)
stt_service = TranscriptionService()
tts_service = TTSService()

# Active connections
active_connections: Dict[str, WebSocket] = {}

@router.websocket("/ws/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    """WebSocket for real-time interview communication.

    Performs auth AFTER accept so client receives a structured error message
    instead of a silent handshake failure.
    """
    await websocket.accept()

    settings = get_settings()
    token = websocket.query_params.get("token") or websocket.headers.get("Authorization")
    expected = f"Bearer {settings.api_token}" if settings.api_token else None
    if expected and token != expected:
        logger.warning(f"WS auth failed for session {session_id}. Provided token: {token!r}")
        await websocket.send_json({
            "type": "error",
            "code": 401,
            "message": "Unauthorized or missing token. Supply ?token=Bearer%20<API_TOKEN>"
        })
        # Close with custom code to allow client to stop reconnecting
        await websocket.close(code=4401, reason="auth_failed")
        return
    active_connections[session_id] = websocket
    logger.info(f"WebSocket connected: {session_id}")
    
    # BUFFER: Store audio chunks here until we have enough to transcribe
    # This prevents the CPU from being overloaded by transcribing tiny 100ms chunks
    audio_buffer = bytearray()
    
    try:
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "message": "WebSocket connected successfully"
        })
        
        while True:
            # Receive message
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON payload"})
                continue
            
            msg_type = message.get("type")
            
            if msg_type == "audio_chunk":
                # Pass the buffer to the handler
                await handle_audio_chunk(websocket, session_id, message, audio_buffer)
            
            elif msg_type == "request_question":
                await handle_request_question(websocket, session_id, message)
            
            elif msg_type == "submit_response":
                await handle_submit_response(websocket, session_id, message)
            
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}"
                })
    
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