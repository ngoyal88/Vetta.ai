"""
LiveKit Routes - Token generation and room management
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from livekit import api

from config import get_settings
from utils.auth import verify_api_token
from utils.logger import get_logger
from services.pipeline_manager import pipeline_manager

router = APIRouter(prefix="/livekit", tags=["LiveKit"])
logger = get_logger("LiveKitRoutes")
settings = get_settings()


class JoinRoomRequest(BaseModel):
    session_id: str
    user_id: str
    user_name: str


@router.post("/token")
async def get_livekit_token(
    request: JoinRoomRequest,
    auth: None = Depends(verify_api_token)
):
    """
    Generate LiveKit access token for candidate to join interview room
    
    Returns:
        - token: JWT token for LiveKit
        - url: LiveKit server URL
        - room_name: Name of the room
    """
    
    try:
        room_name = f"interview-{request.session_id}"
        
        # Generate token for candidate
        token = api.AccessToken(
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret
        )
        
        token.with_identity(request.user_id)
        token.with_name(request.user_name)
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,      # Can send audio/video
            can_subscribe=True,    # Can receive audio/video
            can_publish_data=True  # Can send data messages
        ))
        
        jwt_token = token.to_jwt()
        
        logger.info(f"Generated token for {request.user_name} ({request.user_id}) to join {room_name}")
        
        # Start AI pipeline for this interview
        pipeline_started = pipeline_manager.start_pipeline(request.session_id)
        if not pipeline_started:
            logger.warning(f"Pipeline already running for {request.session_id}")
        
        return {
            "token": jwt_token,
            "url": settings.livekit_url,
            "room_name": room_name,
            "pipeline_status": "starting" if pipeline_started else "already_running"
        }
        
    except Exception as e:
        logger.error(f"Failed to generate token: {e}", exc_info=True)
        raise HTTPException(500, "Failed to generate access token")


@router.get("/room/{session_id}/status")
async def get_room_status(
    session_id: str,
    auth: None = Depends(verify_api_token)
):
    """Check if interview room and pipeline are active"""
    
    try:
        room_name = f"interview-{session_id}"
        
        # Check pipeline status
        pipeline_status = pipeline_manager.get_status(session_id)
        
        return {
            "room_name": room_name,
            "session_id": session_id,
            "pipeline_active": pipeline_status == "running",
            "url": settings.livekit_url
        }
        
    except Exception as e:
        logger.error(f"Failed to check status: {e}", exc_info=True)
        raise HTTPException(500, "Failed to check room status")


@router.post("/room/{session_id}/end")
async def end_interview_room(
    session_id: str,
    auth: None = Depends(verify_api_token)
):
    """End interview and stop pipeline"""
    
    try:
        # Stop pipeline
        stopped = pipeline_manager.stop_pipeline(session_id)
        
        if stopped:
            logger.info(f"Interview ended for session {session_id}")
            return {"message": "Interview ended successfully"}
        else:
            raise HTTPException(404, "Interview session not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to end interview: {e}", exc_info=True)
        raise HTTPException(500, "Failed to end interview")