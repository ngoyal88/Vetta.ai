"""LiveKit agent — Redis session helpers."""
from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, Optional

from config import get_settings
from redis.asyncio import Redis

from services.interview.session_store import SessionStore
from utils.logger import get_logger
from utils.session_errors import SessionConflictError

settings = get_settings()
log = get_logger("InterviewAgent")

SESSION_TTL = getattr(settings, "interview_session_ttl_seconds", 7200)

_worker_redis: Optional[Redis] = None
_worker_redis_loop: Optional[asyncio.AbstractEventLoop] = None
_session_locks: Dict[str, asyncio.Lock] = {}


def redis_url() -> str:
    url = (os.environ.get("REDIS_URL") or getattr(settings, "redis_url", "") or "").strip()
    if url.lower().startswith("https://"):
        return "rediss://" + url[8:]
    return url


async def ensure_redis() -> Redis:
    global _worker_redis, _worker_redis_loop
    loop = asyncio.get_running_loop()
    if _worker_redis is not None and _worker_redis_loop is loop:
        return _worker_redis
    if _worker_redis is not None:
        try:
            await _worker_redis.aclose()
        except Exception:
            pass
    url = redis_url()
    if url:
        _worker_redis = Redis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=10,
            socket_keepalive=True,
            health_check_interval=30,
        )
    else:
        _worker_redis = Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password or os.getenv("REDIS_PASSWORD") or None,
            db=getattr(settings, "redis_db", 0),
            decode_responses=True,
            ssl=getattr(settings, "redis_ssl", False),
        )
    _worker_redis_loop = loop
    return _worker_redis


async def session_store(session_key: str, ttl: int = SESSION_TTL) -> SessionStore:
    return SessionStore(session_key, redis_client=await ensure_redis(), ttl=ttl)


async def get_session(session_key: str) -> Optional[Dict[str, Any]]:
    try:
        return await (await session_store(session_key)).get()
    except Exception as e:
        log.error("Error retrieving session %s: %s", session_key, e, exc_info=True)
        return None


def session_id_from_key(session_key: str) -> str:
    return session_key.removeprefix("interview:")


def session_lock(session_id: str) -> asyncio.Lock:
    lock = _session_locks.get(session_id)
    if lock is None:
        lock = asyncio.Lock()
        _session_locks[session_id] = lock
    return lock


async def mutate_session(
    session_key: str,
    mutator,
    ttl: int = SESSION_TTL,
    *,
    max_attempts: int = 4,
) -> Optional[Dict[str, Any]]:
    session_id = session_id_from_key(session_key)
    async with session_lock(session_id):
        store = await session_store(session_key, ttl=ttl)
        last_exc: Optional[Exception] = None
        for attempt in range(max_attempts):
            try:
                return await store.update(mutator)
            except SessionConflictError as exc:
                last_exc = exc
                if attempt + 1 >= max_attempts:
                    raise
                await asyncio.sleep(0.05 * (attempt + 1))
        if last_exc:
            raise last_exc
    return None


async def replace_session(session_key: str, data: Dict[str, Any], ttl: int = SESSION_TTL) -> None:
    """Full-blob replace — retained for legacy DSA control paths only."""
    try:
        await (await session_store(session_key, ttl=ttl)).replace(data)
    except Exception as e:
        log.error("Error updating session %s: %s", session_key, e, exc_info=True)
