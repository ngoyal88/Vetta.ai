# ========================================
# 7. routes/interview_session.py - Main interview endpoints
# ========================================

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone

from services.interview_service import InterviewService
from services.code_execution_service import CodeExecutionService
from services.transcription_service import TranscriptionService
from models.interview import (
    InterviewType, DifficultyLevel, InterviewSession,
    CodeSubmission, TranscriptionEntry
)
from utils.redis_client import create_session, get_session, update_session
from utils.auth import verify_api_token
from utils.logger import get_logger
from config import get_settings  # Add this import

router = APIRouter(prefix="/interview", tags=["Interview"])
logger = get_logger("InterviewRoutes")

interview_service = InterviewService()
code_service = CodeExecutionService()
transcription_service = TranscriptionService()


class StartInterviewRequest(BaseModel):
    user_id: str
    interview_type: InterviewType
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    custom_role: Optional[str] = None  # For custom interviews
    resume_data: Optional[dict] = None


class SubmitResponseRequest(BaseModel):
    session_id: str
    question_index: int
    response: str
    response_time_seconds: int


class SubmitCodeRequest(BaseModel):
    session_id: str
    question_id: str
    language: str
    code: str


class AddTranscriptionRequest(BaseModel):
    session_id: str
    speaker: str  # "candidate" or "interviewer"
    text: str


@router.post("/start")
async def start_interview(
    request: StartInterviewRequest,
    auth: None = Depends(verify_api_token)
):
    """Start a new interview session"""
    try:
        # Validate custom role
        if request.interview_type == InterviewType.CUSTOM and not request.custom_role:
            raise HTTPException(400, "custom_role required for custom interviews")
        
        session_id = str(uuid.uuid4())
        
        # Generate first question
        first_question = await interview_service.generate_first_question(
            request.interview_type,
            request.difficulty,
            request.resume_data,
            request.custom_role
        )
        
        # Create session
        session = InterviewSession(
            session_id=session_id,
            user_id=request.user_id,
            interview_type=request.interview_type,
            custom_role=request.custom_role,
            difficulty=request.difficulty,
            questions=[first_question],
            resume_data=request.resume_data or {}
        )
        
        # Store in Redis
        await create_session(
            f"interview:{session_id}",
            session.dict(),
            expire_seconds=7200  # 2 hours
        )
        
        logger.info(f"Started interview: {session_id}, type: {request.interview_type}")
        
        return {
            "message": "Interview session started",
            "session_id": session_id,
            "question": first_question,
            "interview_type": request.interview_type,
            "difficulty": request.difficulty
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing code: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.post("/next-question")
async def get_next_question(
    session_id: str,
    auth: None = Depends(verify_api_token)
):
    """Generate and get next question"""
    try:
        session_data = await get_session(f"interview:{session_id}")
        if not session_data:
            raise HTTPException(404, "Session not found")
        
        session = InterviewSession(**session_data)
        
        # Check if max questions reached
        max_questions = get_settings().max_questions_per_interview
        if len(session.questions) >= max_questions:
            return {
                "message": "Maximum questions reached",
                "should_end": True
            }
        
        # Generate follow-up question
        next_question = await interview_service.generate_follow_up(
            session.responses,
            session.interview_type
        )
        
        # Add to session
        session.questions.append({
            'question': next_question,
            'type': session.interview_type.value,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        session.current_question_index += 1
        session.last_updated = datetime.now(timezone.utc)
        
        await update_session(f"interview:{session_id}", session.dict())
        
        return {
            "question": next_question,
            "question_index": session.current_question_index,
            "total_questions": len(session.questions)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating next question: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.post("/add-transcription")
async def add_transcription(
    request: AddTranscriptionRequest,
    auth: None = Depends(verify_api_token)
):
    """Add live transcription entry (for subtitles)"""
    try:
        session_data = await get_session(f"interview:{request.session_id}")
        if not session_data:
            raise HTTPException(404, "Session not found")
        
        session = InterviewSession(**session_data)
        
        # Add transcription entry
        entry = {
            'speaker': request.speaker,
            'text': request.text,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        session.live_transcription.append(entry)
        
        await update_session(f"interview:{request.session_id}", session.dict())
        
        return {
            "message": "Transcription added",
            "entry": entry
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding transcription: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.get("/transcriptions/{session_id}")
async def get_transcriptions(
    session_id: str,
    auth: None = Depends(verify_api_token)
):
    """Get all live transcriptions for session"""
    try:
        session_data = await get_session(f"interview:{session_id}")
        if not session_data:
            raise HTTPException(404, "Session not found")
        
        session = InterviewSession(**session_data)
        
        return {
            "transcriptions": session.live_transcription,
            "total": len(session.live_transcription)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/complete")
async def complete_interview(
    session_id: str,
    auth: None = Depends(verify_api_token)
):
    """Complete interview and generate final feedback"""
    try:
        session_data = await get_session(f"interview:{session_id}")
        if not session_data:
            raise HTTPException(404, "Session not found")
        
        session = InterviewSession(**session_data)
        
        # Calculate duration
        duration = (datetime.now(timezone.utc) - session.started_at).total_seconds() / 60
        
        # Generate final feedback
        feedback_data = {
            'interview_type': session.interview_type.value,
            'custom_role': session.custom_role,
            'duration': int(duration),
            'responses': session.responses,
            'code_submissions': [s.dict() for s in session.code_submissions]
        }
        
        final_feedback = await interview_service.generate_final_feedback(feedback_data)
        
        # Update session
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)
        
        await update_session(f"interview:{session_id}", session.dict())
        
        return {
            "message": "Interview completed",
            "feedback": final_feedback,
            "duration_minutes": int(duration),
            "questions_answered": len(session.responses),
            "code_problems_attempted": len(session.code_submissions)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing interview: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.get("/session/{session_id}")
async def get_session_details(
    session_id: str,
    auth: None = Depends(verify_api_token)
):
    """Get complete session details"""
    try:
        session_data = await get_session(f"interview:{session_id}")
        if not session_data:
            raise HTTPException(404, "Session not found")
        
        return session_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/user/{user_id}/sessions")
async def get_user_sessions(
    user_id: str,
    limit: int = 10,
    auth: None = Depends(verify_api_token)
):
    """Get all sessions for a user"""
    try:
        # This would query from Firestore or Redis
        # For now, return placeholder
        return {
            "user_id": user_id,
            "sessions": [],
            "total": 0,
            "message": "Session history not implemented yet"
        }
        
    except Exception as e:
        raise HTTPException(500, str(e))
