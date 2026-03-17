from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from models.interview import CodeSubmission, InterviewSession, TestCase
from utils.auth import verify_firebase_token
from utils.rate_limit import check_rate_limit
from utils.redis_client import get_session, update_session

from . import SESSION_TTL, code_service, logger, router


class SubmitCodeRequest(BaseModel):
    session_id: str
    question_id: str
    language: str
    code: str = Field(..., max_length=50_000)


@router.post("/submit-code")
async def submit_code(
    request: SubmitCodeRequest,
    uid: str = Depends(verify_firebase_token),
):
    """Execute code against test cases (DSA interviews)."""
    try:
        await check_rate_limit(uid, "submit_code", limit=30, window_seconds=60)

        session_data = await get_session(f"interview:{request.session_id}")
        if not session_data:
            raise HTTPException(404, "Session not found")

        if session_data.get("user_id") and session_data.get("user_id") != uid:
            raise HTTPException(403, "Not authorized for this session")

        session = InterviewSession(**session_data)

        question_inner: Optional[dict] = None
        for q in session.questions:
            inner = q.get("question") if isinstance(q.get("question"), dict) else q
            if not isinstance(inner, dict):
                continue
            if inner.get("question_id") == request.question_id or inner.get("title") == request.question_id:
                question_inner = inner
                break

        if not question_inner:
            raise HTTPException(404, f"Question {request.question_id} not found")

        test_cases = []
        for tc in question_inner.get("test_cases", []) or []:
            if not isinstance(tc, dict):
                continue
            inp = str(tc.get("input", "") or "")
            out = str(tc.get("expected_output") or tc.get("output", "") or "")
            if not inp.strip() and not out.strip():
                continue
            test_cases.append(TestCase(input=inp, expected_output=out.strip(), is_hidden=tc.get("is_hidden", False)))

        if not test_cases:
            raise HTTPException(400, "No test cases found")

        language_id = code_service.get_language_id(request.language)
        logger.info(
            "code_execute",
            extra={"session_id": request.session_id, "user_id": uid, "language": request.language},
        )
        result = await code_service.execute_code(request.code, language_id, test_cases)

        session.code_submissions.append(
            CodeSubmission(
                session_id=request.session_id,
                question_id=request.question_id,
                language=request.language,
                code=request.code,
                timestamp=datetime.now(timezone.utc),
            )
        )
        session.last_updated = datetime.now(timezone.utc)
        await update_session(f"interview:{request.session_id}", session.dict(), expire_seconds=SESSION_TTL)

        # Append a lightweight code_result entry so the agent can reference pass/fail state.
        updated = await get_session(f"interview:{request.session_id}")
        if updated:
            code_results = updated.get("code_results", []) or []
            code_results.append(
                {
                    "question_id": request.question_id,
                    "language": request.language,
                    "passed": result.passed,
                    "tests_passed": result.passed_tests,
                    "total_tests": result.total_tests,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            updated["code_results"] = code_results
            await update_session(f"interview:{request.session_id}", updated, expire_seconds=SESSION_TTL)

        logger.info(
            "code_executed",
            extra={"session_id": request.session_id, "passed": result.passed_tests, "total": result.total_tests},
        )

        return {
            "message": "Code executed successfully",
            "result": result.dict(),
            "passed": result.passed,
            "tests_passed": result.passed_tests,
            "total_tests": result.total_tests,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error executing code: %s", e, exc_info=True)
        raise HTTPException(500, str(e))
