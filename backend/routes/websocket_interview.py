# ========================================
# 8. routes/websocket_interview.py - WebSocket for real-time
# ========================================

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import base64
from typing import Dict
from utils.logger import get_logger
from datetime import datetime, timezone
from utils.redis_client import create_session, get_session, update_session
from services.interview_service import interview_service  # Import the interview_service
from routes.interview_session import InterviewSession  # Import InterviewSession

router = APIRouter()
logger = get_logger("WebSocketInterview")

# Active connections
active_connections: Dict[str, WebSocket] = {}


@router.websocket("/ws/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    """WebSocket for real-time interview communication"""
    await websocket.accept()
    active_connections[session_id] = websocket
    logger.info(f"WebSocket connected: {session_id}")
    
    try:
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "message": "WebSocket connected successfully"
        })
        
        while True:
            # Receive message
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type")
            
            if msg_type == "audio_chunk":
                await handle_audio_chunk(websocket, session_id, message)
            
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


async def handle_audio_chunk(websocket: WebSocket, session_id: str, message: dict):
    """Handle audio chunk for live transcription"""
    try:
        audio_base64 = message.get("audio", "")
        speaker = message.get("speaker", "candidate")
        
        if not audio_base64:
            return
        
        # Decode audio
        audio_bytes = base64.b64decode(audio_base64)
        
        # Transcribe (placeholder - implement actual transcription)
        transcription = f"[Audio transcription for {speaker}]"
        
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
        await websocket.send_json({
            "type": "error",
            "message": "Failed to process audio"
        })


async def handle_request_question(websocket: WebSocket, session_id: str, message: dict):
    """Handle request for next question"""
    try:
        session_data = await get_session(f"interview:{session_id}")
        if not session_data:
            await websocket.send_json({
                "type": "error",
                "message": "Session not found"
            })
            return
        
        session = InterviewSession(**session_data)
        
        # Get current or next question
        if session.current_question_index < len(session.questions):
            question = session.questions[session.current_question_index]
        else:
            # Generate new question
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
        
        await websocket.send_json({
            "type": "question",
            "question": question,
            "question_index": session.current_question_index
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
