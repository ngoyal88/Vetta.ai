import os
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import uuid4
from datetime import datetime, timezone

from utils.auth import verify_api_token
from utils.redis_client import create_session, get_session, update_session
from models.session import SessionData
from models.interview import InterviewState
from models.request import InterviewStartRequest, AnswerSubmitRequest
from services.llm_service import generate_question
from fastapi.encoders import jsonable_encoder
from utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()

@router.post("/interview/start")
async def start_interview(payload: InterviewStartRequest, auth: None = Depends(verify_api_token)):
    """
    Start a single-round interview session. Generates the FIRST question on-demand via LLM
    (Gemini) when configured; falls back to local bank otherwise.
    """
    user = payload.user
    interview_type = payload.interview_type
    difficulty = payload.difficulty
    tags = payload.tags or []

    if not user or not interview_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing user or interview_type")

    session_id = str(uuid4())
    started_at = datetime.now(timezone.utc).isoformat()

    # Generate / fetch only the FIRST question now (on-demand).
    try:
        first_q = await generate_question(interview_type, difficulty=difficulty, tags=tags)
    except Exception as e:
        log.error(f"LLM generate_question failed: {e}", exc_info=True)
        # fallback to an empty question if generation fails
        first_q = {}

    # Build interview state: store questions list with first_q as the 0th element (if any)
    questions = [first_q] if first_q else []
    interview_state = InterviewState(
        session_id=session_id,
        interview_type=interview_type,
        questions=questions,
        current_question_index=0,
        answers={},
        started_at=started_at,
        last_updated=started_at
    )

    # Session meta (lightweight)
    session_meta = {
        "user": user,
        "interview_type": interview_type,
        "mode": "single_round_on_demand",
        "started_at": started_at,
    }

    # Persist: session meta and interview state
    try:
        # lightweight meta as a redis hash
        await create_session(session_id, jsonable_encoder(session_meta))
        # store full state as JSON string (use update_session which does json.dumps)
        await update_session(f"interview:{session_id}", jsonable_encoder(interview_state))
    except Exception as e:
        log.error(f"Failed to persist interview session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create interview session")

    # return the first question (or null) and session_id
    return {
        "session_id": session_id,
        "interview_type": interview_type,
        "first_question": first_q or None,
        "message": "Interview session started ✅"
    }


@router.get("/interview/state/{session_id}")
async def get_interview_state(session_id: str, auth: None = Depends(verify_api_token)):
    try:
        state_data = await get_session(f"interview:{session_id}")
        if not state_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Interview state not found"
            )
        return state_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving state: {str(e)}")


@router.post("/interview/answer/{session_id}")
async def submit_answer(session_id: str, payload: AnswerSubmitRequest, auth: None = Depends(verify_api_token)):
    try:
        state_data = await get_session(f"interview:{session_id}")
        if not state_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Interview state not found"
            )

        state_data["answers"][str(payload.question_index)] = payload.answer
        state_data["last_updated"] = datetime.now(timezone.utc).isoformat()

        await update_session(f"interview:{session_id}", jsonable_encoder(state_data))

        return {
            "message": "Answer submitted successfully ✅",
            "state": state_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating session: {str(e)}")
