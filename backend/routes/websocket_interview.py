# ========================================
# 8. routes/websocket_interview.py - WebSocket for real-time
# ========================================

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import base64
from typing import Dict, List
from utils.logger import get_logger
from datetime import datetime, timezone
from utils.redis_client import create_session, get_session, update_session
from services.interview_service import interview_service 
from services.transcription_service import TranscriptionService
from services.tts_service import TTSService
from routes.interview_session import InterviewSession 

router = APIRouter()
logger = get_logger("WebSocketInterview")

# Initialize AI Services (Global to avoid reloading models per connection)
stt_service = TranscriptionService()
tts_service = TTSService()

# Active connections
active_connections: Dict[str, WebSocket] = {}

@router.websocket("/ws/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    """WebSocket for real-time interview communication"""
    await websocket.accept()
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
    """Handle audio chunk for live transcription with Buffering"""
    try:
        audio_base64 = message.get("audio", "")
        speaker = message.get("speaker", "candidate")
        
        if not audio_base64:
            return
        
        # 1. Decode audio and add to buffer
        chunk = base64.b64decode(audio_base64)
        audio_buffer.extend(chunk)
        
        # 2. Transcribe only if we have enough data (approx 2 seconds @ 16kHz)
        # 64000 bytes ~ 2 seconds of 16kHz Mono 16-bit audio
        BUFFER_THRESHOLD = 64000
        
        if len(audio_buffer) > BUFFER_THRESHOLD:
            # Transcribe the accumulated buffer
            transcription = await stt_service.transcribe_audio_bytes(bytes(audio_buffer))
            
            # Clear buffer after processing
            # We use del[:] to clear it in-place since it's passed by reference
            del audio_buffer[:] 

            if transcription:
                # Send transcription back
                await websocket.send_json({
                    "type": "transcription",
                    "speaker": speaker,
                    "text": transcription,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                # Store in session
                session_data = await get_session(f"interview:{session_id}")
                if session_data:
                    session = InterviewSession(**session_data)
                    session.live_transcription.append({
                        "speaker": speaker,
                        "text": transcription,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    await update_session(f"interview:{session_id}", session.dict())
        
    except Exception as e:
        logger.error(f"Error handling audio chunk: {e}", exc_info=True)
        # Don't send error to frontend for every chunk failure to avoid spamming
        # But ensure buffer is cleared to prevent memory leaks in case of bad data
        if len(audio_buffer) > 1000000: # Safety cap
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