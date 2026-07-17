"""Code submission orchestration for pair-programming / DSA sessions."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, Protocol

from fastapi import HTTPException

from models.interview import CodeSubmission, InterviewSession, TestCase
from services.interview.session_store import SessionStore, deep_merge_session_conductor
from utils.logger import get_logger
from utils.redis_client import get_session

logger = get_logger(__name__)


class CodeExecutionResult(Protocol):
    passed: bool
    passed_tests: int
    total_tests: int

    def dict(self) -> dict[str, Any]: ...


class CodeExecutor(Protocol):
    async def execute_code(
        self, code: str, language_id: int, test_cases: list[TestCase]
    ) -> CodeExecutionResult: ...

    def get_language_id(self, language: str) -> int: ...


def find_question_inner(session: InterviewSession, question_id: str) -> Optional[dict[str, Any]]:
    for q in session.questions:
        inner = q.get("question") if isinstance(q.get("question"), dict) else q
        if not isinstance(inner, dict):
            continue
        if inner.get("question_id") == question_id or inner.get("title") == question_id:
            return inner
    return None


def build_test_cases(question_inner: dict[str, Any]) -> list[TestCase]:
    test_cases: list[TestCase] = []
    for tc in question_inner.get("test_cases", []) or []:
        if not isinstance(tc, dict):
            continue
        inp = str(tc.get("input", "") or "")
        out = str(tc.get("expected_output") or tc.get("output", "") or "")
        if not inp.strip() and not out.strip():
            continue
        test_cases.append(
            TestCase(input=inp, expected_output=out.strip(), is_hidden=tc.get("is_hidden", False))
        )
    return test_cases


def _append_submission_fields(session_data: dict[str, Any], session: InterviewSession) -> dict[str, Any]:
    """Merge InterviewSession fields into existing blob without dropping extra keys."""
    dumped = session.model_dump(mode="json")
    merged = deep_merge_session_conductor(session_data, dumped)
    for key, value in dumped.items():
        if key != "session_conductor":
            merged[key] = value
    return merged


async def _persist_mutator(
    session_key: str,
    mutator,
    *,
    session_ttl: int,
) -> dict[str, Any]:
    store = SessionStore(session_key, ttl=session_ttl)

    def _merge(current: dict[str, Any]) -> dict[str, Any]:
        base = dict(current) if isinstance(current, dict) else {}
        patch = mutator(base)
        return deep_merge_session_conductor(base, patch)

    return await store.update(_merge)


async def submit_code(
    *,
    session_id: str,
    question_id: str,
    language: str,
    code: str,
    uid: str,
    code_service: CodeExecutor,
    session_ttl: int,
) -> dict[str, Any]:
    session_key = f"interview:{session_id}"
    session_data = await get_session(session_key)
    if not session_data:
        raise HTTPException(404, "Session not found")

    session = InterviewSession(**session_data)

    question_inner = find_question_inner(session, question_id)
    if not question_inner:
        raise HTTPException(404, f"Question {question_id} not found")

    test_cases = build_test_cases(question_inner)
    if not test_cases:
        raise HTTPException(400, "No test cases found")

    language_id = code_service.get_language_id(language)
    logger.info(
        "code_execute",
        extra={"session_id": session_id, "user_id": uid, "language": language},
    )
    result = await code_service.execute_code(code, language_id, test_cases)

    session.code_submissions.append(
        CodeSubmission(
            session_id=session_id,
            question_id=question_id,
            language=language,
            code=code,
            timestamp=datetime.now(timezone.utc),
        )
    )
    session.last_updated = datetime.now(timezone.utc)

    code_result_entry = {
        "question_id": question_id,
        "language": language,
        "passed": result.passed,
        "tests_passed": result.passed_tests,
        "total_tests": result.total_tests,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    def _first_write(current: dict[str, Any]) -> dict[str, Any]:
        return _append_submission_fields(current, session)

    await _persist_mutator(session_key, _first_write, session_ttl=session_ttl)

    def _append_result(current: dict[str, Any]) -> dict[str, Any]:
        base = dict(current)
        code_results = list(base.get("code_results", []) or [])
        code_results.append(code_result_entry)
        base["code_results"] = code_results
        return base

    await _persist_mutator(session_key, _append_result, session_ttl=session_ttl)

    logger.info(
        "code_executed",
        extra={"session_id": session_id, "passed": result.passed_tests, "total": result.total_tests},
    )

    return {
        "message": "Code executed successfully",
        "result": result.model_dump(mode="json"),
        "passed": result.passed,
        "tests_passed": result.passed_tests,
        "total_tests": result.total_tests,
    }
