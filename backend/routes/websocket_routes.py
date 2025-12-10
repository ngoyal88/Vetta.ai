# backend/routes/websocket_routes.py
"""
WebSocket routes for real-time interview
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from services.interview_websocket import InterviewWebSocketHandler
from utils.auth import verify_api_token
from utils.logger import get_logger

router = APIRouter(prefix="/ws", tags=["WebSocket"])
logger = get_logger("WebSocketRoutes")


@router.websocket("/interview/{session_id}")
async def interview_websocket(
    websocket: WebSocket,
    session_id: str
):
    """
    WebSocket endpoint for real-time interview
    
    Client sends:
    - Audio chunks (bytes)
    - Control messages (JSON)
    
    Server sends:
    - Questions with audio
    - Transcripts
    - Status updates
    - Feedback
    """
    handler = InterviewWebSocketHandler(websocket, session_id)
    await handler.handle_connection()