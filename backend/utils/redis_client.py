"""Redis client and session helpers."""
import json
import os

from fastapi.encoders import jsonable_encoder
from redis.asyncio import Redis

from config import get_settings
from utils.logger import get_logger

log = get_logger(__name__)
settings = get_settings()

_redis_url = (os.environ.get("REDIS_URL") or getattr(settings, "redis_url", "") or "").strip()

if _redis_url.lower().startswith("https://"):
    _redis_url = "rediss://" + _redis_url[8:]

if _redis_url:
    redis = Redis.from_url(
        _redis_url,
        decode_responses=True,
        socket_connect_timeout=10,
        socket_keepalive=True,
        health_check_interval=30,
    )
else:
    _redis_ssl_env = os.environ.get("REDIS_SSL", "").strip().lower()
    _redis_ssl = (
        _redis_ssl_env in ("1", "true", "yes") if _redis_ssl_env
        else getattr(settings, "redis_ssl", False)
    )
    redis = Redis(
        host=os.environ.get("REDIS_HOST") or settings.redis_host,
        port=int(os.environ.get("REDIS_PORT") or settings.redis_port),
        password=settings.redis_password or os.getenv("REDIS_PASSWORD") or None,
        db=getattr(settings, "redis_db", 0),
        decode_responses=True,
        ssl=_redis_ssl,
    )


async def close_redis() -> None:
    """Best-effort shutdown of the Redis connection pool."""
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
        pong = await redis.ping()
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
    await redis.set(session_id, json.dumps(safe), ex=expire_seconds)
    log.info("Session %s created", session_id)


async def get_session(session_key: str):
    try:
        raw = await redis.get(session_key)
        if raw:
            return json.loads(raw)
    except Exception as e:
        log.error("Error retrieving session %s: %s", session_key, e, exc_info=True)
        raise
    return None


async def update_session(session_key: str, data: dict, expire_seconds: int = 3600) -> None:
    try:
        safe = jsonable_encoder(data)
        await redis.set(session_key, json.dumps(safe), ex=expire_seconds)
        log.info("Session %s updated", session_key)
    except Exception as e:
        log.error("Error updating session %s: %s", session_key, e, exc_info=True)


async def delete_session(session_id: str) -> bool:
    try:
        result = await redis.delete(session_id)
        if result:
            log.info("Session %s deleted", session_id)
            return True
    except Exception as e:
        log.error("Error deleting session %s: %s", session_id, e, exc_info=True)
        raise
    return False
