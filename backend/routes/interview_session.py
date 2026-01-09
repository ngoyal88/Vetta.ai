from fastapi import APIRouter, HTTPException, Depends
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from firebase_admin import firestore
from firebase_config import db

from services.interview_service import InterviewService
from services.code_execution_service import CodeExecutionService
from models.interview import (
    InterviewType, DifficultyLevel, InterviewSession,
    CodeSubmission
)
from utils.redis_client import create_session, get_session, update_session, delete_session
from utils.auth import verify_api_token
from utils.logger import get_logger
from config import get_settings
# Firestore writes removed for now; will be added later

router = APIRouter(prefix="/interview", tags=["Interview"])
logger = get_logger("InterviewRoutes")

interview_service = InterviewService()
code_service = CodeExecutionService()
settings = get_settings()


def _parse_scores_from_feedback(feedback_text: Optional[str]) -> Dict[str, Any]:
    """Extract simple numeric scores from the final feedback text (best effort)."""
    if not feedback_text:
        return {}

    import re

    scores = {}
    tech_match = re.search(r"TECHNICAL SKILLS:\s*(\d+(?:\.\d+)?)/10", feedback_text, re.IGNORECASE)
    comm_match = re.search(r"COMMUNICATION:\s*(\d+(?:\.\d+)?)/10", feedback_text, re.IGNORECASE)
    overall_match = re.search(r"SCORE:\s*(\d+(?:\.\d+)?)/10", feedback_text, re.IGNORECASE)

    if tech_match:
        scores["technical"] = float(tech_match.group(1))
    if comm_match:
        scores["communication"] = float(comm_match.group(1))
    if overall_match:
        scores["overall"] = float(overall_match.group(1))
    elif scores:
        # If we found any component scores, average them for a basic overall value
        scores["overall"] = sum(scores.values()) / len(scores)

    return scores


def _serialize_firestore_timestamp(ts: Any) -> Any:
    """Convert Firestore timestamps to ISO strings for API responses."""
    if isinstance(ts, datetime):
        return ts.isoformat()
    return ts


class StartInterviewRequest(BaseModel):
    user_id: str
    candidate_name: Optional[str] = None
    interview_type: InterviewType
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    custom_role: Optional[str] = None
    resume_data: Optional[dict] = None
    years_experience: Optional[int] = None


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
            request.custom_role,
            request.years_experience
        )

        # Prefer an explicit candidate name, else derive from resume if present
        candidate_name = request.candidate_name or (
            (request.resume_data or {}).get("name", {}).get("raw") if isinstance(request.resume_data, dict) else None
        ) or request.user_id
        
        # Create session
        session = InterviewSession(
            session_id=session_id,
            user_id=request.user_id,
            candidate_name=candidate_name,
            years_experience=request.years_experience,
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

        # Persist lightweight record to Firestore for history
        try:
            db.collection("interviews").document(session_id).set({
                "session_id": session_id,
                "user_id": request.user_id,
                "candidate_name": candidate_name,
                "years_experience": request.years_experience,
                "interview_type": request.interview_type.value,
                "difficulty": request.difficulty.value,
                "custom_role": request.custom_role,
                "status": "active",
                "started_at": firestore.SERVER_TIMESTAMP,
                "created_at": firestore.SERVER_TIMESTAMP,
                "last_updated": firestore.SERVER_TIMESTAMP,
                "questions_answered": 0,
                "code_problems_attempted": 0,
            })
        except Exception as e:
            logger.warning(f"Failed to persist interview start to Firestore: {e}")
        
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

        # Firestore update
        try:
            scores = _parse_scores_from_feedback(final_feedback.get('feedback'))
            payload = jsonable_encoder({
                "session_id": session_id,
                "user_id": session.user_id,
                "candidate_name": session.candidate_name,
                "interview_type": session.interview_type.value,
                "difficulty": session.difficulty.value,
                "custom_role": session.custom_role,
                "status": "completed",
                "duration_minutes": int(duration),
                "questions_answered": len(session.responses),
                "code_problems_attempted": len(session.code_submissions),
                "responses": session.responses,
                "questions": session.questions,
                "code_submissions": [s.dict() for s in session.code_submissions],
                "live_transcription": session.live_transcription,
                "final_feedback": final_feedback,
                "scores": scores if scores else None,
            })

            # Ensure start timestamps exist if initial write failed
            payload.setdefault("started_at", session.started_at)
            payload.setdefault("created_at", session.started_at)
            payload["last_updated"] = firestore.SERVER_TIMESTAMP
            # Replace timestamp fields after encoding to preserve Firestore sentinel values
            payload["completed_at"] = firestore.SERVER_TIMESTAMP
            if "scores" in payload and not payload["scores"]:
                payload.pop("scores", None)

            db.collection("interviews").document(session_id).set(payload, merge=True)
        except Exception as e:
            logger.warning(f"Failed to persist interview completion to Firestore: {e}")

        
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


@router.get("/history")
async def get_interview_history(
    user_id: str,
    limit: int = 20,
    auth: None = Depends(verify_api_token)
):
    """Return recent interviews for the user from Firestore."""
    try:
        # Cap the limit to avoid heavy reads
        safe_limit = max(1, min(limit, 50))

        # Avoid Firestore composite index requirement by sorting in memory
        query = db.collection("interviews").where("user_id", "==", user_id).limit(safe_limit)

        docs = query.stream()
        history = []
        for doc in docs:
            data = doc.to_dict() or {}
            data["id"] = doc.id
            for ts_key in ("started_at", "completed_at", "created_at", "last_updated"):
                if ts_key in data:
                    data[ts_key] = _serialize_firestore_timestamp(data.get(ts_key))
            history.append(data)

        # Sort client-side by start/completion time descending
        def _sort_key(item):
            return item.get("started_at") or item.get("created_at") or item.get("completed_at") or ""

        history.sort(key=_sort_key, reverse=True)

        return {"history": history}

    except Exception as e:
        logger.error(f"Error fetching history: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch interview history")


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


@router.delete("/history/{session_id}")
async def delete_interview_history(
    session_id: str,
    user_id: str,
    auth: None = Depends(verify_api_token)
):
    """Delete a stored interview history entry for the given user."""
    try:
        doc_ref = db.collection("interviews").document(session_id)
        snapshot = doc_ref.get()
        if not snapshot.exists:
            raise HTTPException(404, "Interview not found")

        data = snapshot.to_dict() or {}
        if data.get("user_id") != user_id:
            raise HTTPException(403, "Not authorized to delete this interview")

        doc_ref.delete()

        # Best-effort cleanup of Redis session
        try:
            await delete_session(f"interview:{session_id}")
        except Exception:
            pass

        return {"message": "Interview deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting interview history: {e}", exc_info=True)
        raise HTTPException(500, "Failed to delete interview")