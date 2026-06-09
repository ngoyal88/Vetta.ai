"""Redis client and session helpers."""
import json
import os
from collections.abc import Callable
from typing import Any, Optional

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from redis.asyncio import Redis
from redis.exceptions import WatchError

from config import get_settings
from utils.logger import get_logger

log = get_logger(__name__)
settings = get_settings()


def create_redis_client(*, pooled: bool = True) -> Redis:
    """Build a Redis client from env/settings. Use pooled=False in tests for isolation."""
    redis_url = (os.environ.get("REDIS_URL") or getattr(settings, "redis_url", "") or "").strip()
    if redis_url.lower().startswith("https://"):
        redis_url = "rediss://" + redis_url[8:]

    if redis_url:
        return Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=10,
            socket_keepalive=pooled,
            health_check_interval=30 if pooled else 0,
        )

    ssl_env = os.environ.get("REDIS_SSL", "").strip().lower()
    use_ssl = ssl_env in ("1", "true", "yes") if ssl_env else getattr(settings, "redis_ssl", False)
    return Redis(
        host=os.environ.get("REDIS_HOST") or settings.redis_host,
        port=int(os.environ.get("REDIS_PORT") or settings.redis_port),
        password=settings.redis_password or os.getenv("REDIS_PASSWORD") or None,
        db=getattr(settings, "redis_db", 0),
        decode_responses=True,
        ssl=use_ssl,
        socket_connect_timeout=5,
        socket_timeout=5,
    )


redis = create_redis_client()


async def get_redis() -> Redis:
    """Return a live Redis client, reconnecting if the pool is stale."""
    global redis
    try:
        await redis.ping()
        return redis
    except Exception as exc:
        log.warning("Redis connection stale; reconnecting: %s", exc)
        # Do not call close_redis() here — the old pool may be bound to a dead loop.
        redis = create_redis_client()
        try:
            await redis.ping()
        except Exception as retry_exc:
            log.error("Redis reconnect failed", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Session store unavailable",
            ) from retry_exc
        return redis


async def close_redis() -> None:
    """Best-effort shutdown of the Redis connection pool."""
    global redis
    try:
        aclose = getattr(redis, "aclose", None)
        if callable(aclose):
            await aclose()
        else:
            close = getattr(redis, "close", None)
            if callable(close):
                result = close()
                if result is not None:
                    await result

        pool = getattr(redis, "connection_pool", None)
        disconnect = getattr(pool, "disconnect", None) if pool is not None else None
        if callable(disconnect):
            result = disconnect()
            if result is not None:
                await result
    except Exception:
        pass


async def test_connection() -> bool:
    try:
        client = await get_redis()
        pong = await client.ping()
        if pong:
            log.info("Redis connection successful")
            return True
    except Exception as e:
        log.error("Redis connection failed: %s", e, exc_info=True)
        if "upstash" in str(e).lower() or "connection" in str(e).lower():
            log.warning(
                "If using Upstash: set REDIS_URL to the Redis (TCP) URL — "
                "e.g. rediss://default:PASSWORD@host:6379"
            )
    return False


async def create_session(session_id: str, data: dict, expire_seconds: int = 3600) -> None:
    safe = jsonable_encoder(data)
    client = await get_redis()
    await client.set(session_id, json.dumps(safe), ex=expire_seconds)
    log.info("Session %s created", session_id)


async def get_session(session_key: str):
    try:
        client = await get_redis()
        raw = await client.get(session_key)
        if raw:
            return json.loads(raw)
    except HTTPException:
        raise
    except Exception as e:
        log.error("Error retrieving session %s: %s", session_key, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session store unavailable",
        ) from e
    return None


async def update_session(session_key: str, data: dict, expire_seconds: int = 3600) -> None:
    try:
        safe = jsonable_encoder(data)
        client = await get_redis()
        await client.set(session_key, json.dumps(safe), ex=expire_seconds)
        log.info("Session %s updated", session_key)
    except Exception as e:
        log.error("Error updating session %s: %s", session_key, e, exc_info=True)
        raise


async def merge_session(
    session_key: str,
    patch: dict,
    expire_seconds: int = 3600,
    *,
    redis_client: Optional[Any] = None,
) -> dict:
    """Shallow-merge patch into the existing session blob."""

    def _mutator(current: dict) -> dict:
        base = current if isinstance(current, dict) else {}
        merged = {**base, **patch}
        return merged

    return await update_session_atomic(
        session_key,
        _mutator,
        expire_seconds=expire_seconds,
        redis_client=redis_client,
    )


async def update_session_atomic(
    session_key: str,
    mutator: Callable[[dict], dict],
    expire_seconds: int = 3600,
    max_retries: int = 3,
    *,
    redis_client: Optional[Any] = None,
) -> dict:
    """Optimistic read-modify-write with Redis WATCH to reduce lost updates."""
    client = redis_client or await get_redis()
    last_error: Optional[Exception] = None

    for _ in range(max_retries):
        try:
            await client.watch(session_key)
            raw = await client.get(session_key)
            current: dict = json.loads(raw) if raw else {}
            updated = mutator(dict(current))
            if not isinstance(updated, dict):
                raise TypeError("Session mutator must return a dict")
            updated["_version"] = int(current.get("_version", 0)) + 1
            safe = jsonable_encoder(updated)
            pipe = client.pipeline()
            pipe.multi()
            pipe.set(session_key, json.dumps(safe), ex=expire_seconds)
            await pipe.execute()
            log.info("Session %s updated atomically (v=%s)", session_key, updated.get("_version"))
            return updated
        except WatchError as e:
            last_error = e
            continue
        except Exception as e:
            last_error = e
            log.error("Error in atomic session update %s: %s", session_key, e, exc_info=True)
            raise
        finally:
            try:
                await client.unwatch()
            except Exception:
                pass

    log.warning(
        "Atomic session update exhausted retries for %s; falling back to SET",
        session_key,
    )
    raw = await client.get(session_key)
    current = json.loads(raw) if raw else {}
    updated = mutator(dict(current))
    if not isinstance(updated, dict):
        raise TypeError("Session mutator must return a dict")
    updated["_version"] = int(current.get("_version", 0)) + 1
    safe = jsonable_encoder(updated)
    await client.set(session_key, json.dumps(safe), ex=expire_seconds)
    if last_error:
        log.debug("Last atomic retry error for %s: %s", session_key, last_error)
    return updated


async def delete_session(session_id: str) -> bool:
    try:
        client = await get_redis()
        result = await client.delete(session_id)
        if result:
            log.info("Session %s deleted", session_id)
            return True
    except Exception as e:
        log.error("Error deleting session %s: %s", session_id, e, exc_info=True)
        raise
    return False


# ---------------------------------------------------------------------------
# WebSocket ticket helpers (short-lived opaque tokens for WS auth)
# ---------------------------------------------------------------------------

WS_TICKET_TTL_SECONDS: int = 60  # tickets expire after 60 s — single use

_WS_TICKET_PREFIX = "ws_ticket:"


async def store_ws_ticket(ticket: str, uid: str, ttl_seconds: int = WS_TICKET_TTL_SECONDS) -> None:
    """Persist a one-time WS ticket mapped to a Firebase UID."""
    key = f"{_WS_TICKET_PREFIX}{ticket}"
    client = await get_redis()
    await client.set(key, uid, ex=ttl_seconds)
    log.info("WS ticket stored (ttl=%ss)", ttl_seconds)


async def get_ws_ticket(ticket: str) -> Optional[str]:
    """Retrieve and consume (delete) a WS ticket; returns the UID or None if missing/expired."""
    key = f"{_WS_TICKET_PREFIX}{ticket}"
    client = await get_redis()
    uid: Optional[str] = await client.getdel(key)
    return uid or None
