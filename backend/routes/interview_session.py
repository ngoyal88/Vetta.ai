from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone

from services.interview_service import InterviewService
from services.code_execution_service import CodeExecutionService
from models.interview import (
    InterviewType, DifficultyLevel, InterviewSession,
    CodeSubmission
)
from utils.redis_client import create_session, get_session, update_session
from utils.auth import verify_api_token
from utils.logger import get_logger
from config import get_settings
# Firestore writes removed for now; will be added later

router = APIRouter(prefix="/interview", tags=["Interview"])
logger = get_logger("InterviewRoutes")

interview_service = InterviewService()
code_service = CodeExecutionService()
settings = get_settings()


class StartInterviewRequest(BaseModel):
    user_id: str
    interview_type: InterviewType
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    custom_role: Optional[str] = None
    resume_data: Optional[dict] = None


class SubmitCodeRequest(BaseModel):
    session_id: str
    question_id: str
    language: str
    code: str


@router.post("/start")
async def start_interview(
    request: StartInterviewRequest,
    auth: None = Depends(verify_api_token)
):
    """Start a new interview session (WebSocket MVP)"""
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

        # Firestore persistence skipped
        
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
        logger.error(f"Error starting interview: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.post("/submit-code")
async def submit_code(
    request: SubmitCodeRequest,
    auth: None = Depends(verify_api_token)
):
    """Execute code against test cases (DSA interviews)"""
    try:
        session_data = await get_session(f"interview:{request.session_id}")
        if not session_data:
            raise HTTPException(404, "Session not found")
        
        session = InterviewSession(**session_data)
        
        # Find the question
        question = None
        for q in session.questions:
            if q.get('question_id') == request.question_id or q.get('title') == request.question_id:
                question = q
                break
        
        if not question:
            raise HTTPException(404, f"Question {request.question_id} not found")
        
        # Get test cases
        test_cases_raw = question.get('test_cases', [])
        
        from models.interview import TestCase
        test_cases = []
        for tc in test_cases_raw:
            test_cases.append(TestCase(
                input=tc.get('input', ''),
                expected_output=tc.get('output', ''),
                is_hidden=tc.get('is_hidden', False)
            ))
        
        if not test_cases:
            raise HTTPException(400, "No test cases found")
        
        # Get language ID for Judge0
        language_id = code_service.get_language_id(request.language)
        
        # Execute code
        logger.info(f"Executing {request.language} code for session {request.session_id}")
        result = await code_service.execute_code(
            request.code,
            language_id,
            test_cases
        )
        
        # Store submission
        submission = CodeSubmission(
            session_id=request.session_id,
            question_id=request.question_id,
            language=request.language,
            code=request.code,
            timestamp=datetime.now(timezone.utc)
        )
        session.code_submissions.append(submission)
        session.last_updated = datetime.now(timezone.utc)
        
        await update_session(f"interview:{request.session_id}", session.dict())
        
        logger.info(f"Code executed: {result.passed_tests}/{result.total_tests} tests passed")
        
        return {
            "message": "Code executed successfully",
            "result": result.dict(),
            "passed": result.passed,
            "tests_passed": result.passed_tests,
            "total_tests": result.total_tests
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing code: {e}", exc_info=True)
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

        # Firestore update skipped

        
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


# History endpoint removed for now


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