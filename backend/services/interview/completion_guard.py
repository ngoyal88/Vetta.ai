"""Shared idempotent interview completion lock and terminal-status helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from config import get_settings
from utils.logger import get_logger
from utils.redis_client import get_redis, get_session

log = get_logger(__name__)

TERMINAL_STATUSES = frozenset({"ended_early", "completed", "incomplete_exit"})
COMPLETION_LOCK_PREFIX = "completion_lock:"


def is_terminal_status(status: Any) -> bool:
    return str(status or "") in TERMINAL_STATUSES


def completion_lock_key(session_id: str) -> str:
    return f"{COMPLETION_LOCK_PREFIX}{session_id}"


def _completion_lock_ttl() -> int:
    return int(getattr(get_settings(), "completion_lock_ttl_seconds", 180))


async def acquire_completion_lock(
    session_id: str,
    *,
    redis_client: Optional[Any] = None,
    ttl: Optional[int] = None,
) -> bool:
    """Return True if this caller owns completion for session_id."""
    client = redis_client or await get_redis()
    lock_ttl = ttl if ttl is not None else _completion_lock_ttl()
    try:
        acquired = await client.set(
            completion_lock_key(session_id),
            "1",
            nx=True,
            ex=lock_ttl,
        )
        return bool(acquired)
    except Exception as exc:
        log.warning("completion_lock_failed session_id=%s error=%s", session_id, exc)
        return False


def cached_completion_from_session(session_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Build API-shaped completion payload from a terminal Redis session blob."""
    if not is_terminal_status(session_data.get("status")):
        return None
    final_feedback = session_data.get("final_feedback")
    if not final_feedback:
        return None
    return {
        "message": "Interview completed",
        "feedback": final_feedback,
        "duration_minutes": int(session_data.get("duration_minutes") or 0),
        "questions_answered": int(session_data.get("questions_answered") or 0),
        "code_problems_attempted": int(session_data.get("code_problems_attempted") or 0),
        "cached": True,
    }


@dataclass
class CompletionBeginResult:
    proceed: bool
    already_complete: bool
    session_data: Optional[Dict[str, Any]] = None
    cached_response: Optional[Dict[str, Any]] = None


async def try_begin_completion(
    session_id: str,
    session_data: Dict[str, Any],
    *,
    redis_client: Optional[Any] = None,
) -> CompletionBeginResult:
    """
    If session is terminal with feedback, return cached response.
    If lock not acquired, re-read session and return cache if another writer finished.
    Otherwise return proceed=True for the caller to run feedback + persist.
    """
    if is_terminal_status(session_data.get("status")):
        cached = cached_completion_from_session(session_data)
        if cached:
            log.info(
                "completion_duplicate_terminal session_id=%s status=%s",
                session_id,
                session_data.get("status"),
            )
            return CompletionBeginResult(
                proceed=False,
                already_complete=True,
                session_data=session_data,
                cached_response=cached,
            )

    if not await acquire_completion_lock(session_id, redis_client=redis_client):
        refreshed = await get_session(f"interview:{session_id}")
        if refreshed and is_terminal_status(refreshed.get("status")):
            cached = cached_completion_from_session(refreshed)
            log.info("completion_lock_contention_cached session_id=%s", session_id)
            return CompletionBeginResult(
                proceed=False,
                already_complete=True,
                session_data=refreshed,
                cached_response=cached,
            )
        log.info("completion_lock_contention_no_cache session_id=%s", session_id)
        return CompletionBeginResult(proceed=False, already_complete=False, session_data=refreshed)

    return CompletionBeginResult(proceed=True, already_complete=False, session_data=session_data)


async def run_completion_once(
    session_id: str,
    session_data: Dict[str, Any],
    runner: Callable[[Dict[str, Any]], Any],
    *,
    redis_client: Optional[Any] = None,
) -> Any:
    """Execute runner only when completion lock is acquired; return cached result otherwise."""
    begin = await try_begin_completion(session_id, session_data, redis_client=redis_client)
    if begin.cached_response is not None:
        return begin.cached_response
    if not begin.proceed:
        return None
    return await runner(begin.session_data or session_data)
