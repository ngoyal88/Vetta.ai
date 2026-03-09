import os
import json
from fastapi.encoders import jsonable_encoder
from redis.asyncio import Redis
from utils.logger import get_logger
from config import get_settings

log = get_logger(__name__)
settings = get_settings()

# Redis: REDIS_URL (Upstash) or host/port for local
_redis_url = (os.environ.get("REDIS_URL") or getattr(settings, "redis_url", "") or "").strip()

# redis-py expects rediss:// for TLS, not https://. Upstash often shows https; normalize.
if _redis_url.lower().startswith("https://"):
    _redis_url = "rediss://" + _redis_url[8:]

if _redis_url:
    # Upstash or any Redis via single URL (e.g. rediss://default:PASS@host:6379)
    # Use Redis (TCP) URL from Upstash dashboard "Redis Connect", not the REST URL.
    redis = Redis.from_url(
        _redis_url,
        decode_responses=True,
        socket_connect_timeout=10,
        socket_keepalive=True,
        health_check_interval=30,
    )
else:
    _redis_host = os.environ.get("REDIS_HOST") or settings.redis_host
    _redis_port = os.environ.get("REDIS_PORT")
    _redis_port = int(_redis_port) if _redis_port else settings.redis_port
    _redis_ssl_raw = os.environ.get("REDIS_SSL", "").strip().lower()
    _redis_ssl = _redis_ssl_raw in ("1", "true", "yes")

    redis = Redis(
        host=_redis_host,
        port=_redis_port,
        password=settings.redis_password or os.getenv("REDIS_PASSWORD") or None,
        db=getattr(settings, "redis_db", 0),
        decode_responses=True,
        ssl=_redis_ssl,
    )


async def close_redis() -> None:
    """Best-effort cleanup for Redis connections/pool."""
    try:
        # redis-py asyncio: aclose() is preferred when available
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
        pass  # Don't crash shutdown on cleanup.

async def test_connection():
    try:
        pong = await redis.ping()
        if pong:
            log.info("✅ Redis connection successful!")
            return True
    except Exception as e:
        log.error(f"❌ Redis connection failed: {e}", exc_info=True)
        if "closed by server" in str(e).lower() or "connection" in str(e).lower():
            log.warning(
                "If using Upstash: set REDIS_URL to the Redis (TCP) URL from the "
                "dashboard (Redis Connect), e.g. rediss://default:YOUR_PASSWORD@host:6379 — not the REST URL."
            )
    return False

async def create_session(session_id: str, data: dict, expire_seconds: int = 3600):
    """Create or overwrite a session (JSON-encoded)."""
    try:
        safe = jsonable_encoder(data)
        await redis.set(session_id, json.dumps(safe), ex=expire_seconds)
        log.info(f"Session {session_id} created/updated.")
    except Exception as e:
        log.error(f"Error creating session {session_id}: {e}", exc_info=True)
        raise

async def get_session(session_id: str):
    """Retrieve a session and decode JSON back to dict."""
    try:
        raw = await redis.get(session_id)
        if raw:
            data = json.loads(raw)
            log.info(f"Session {session_id} retrieved.")
            return data
    except Exception as e:
        log.error(f"Error retrieving session {session_id}: {e}", exc_info=True)
        raise
    return None

async def update_session(session_id: str, data: dict, expire_seconds: int = 3600):
    """Update (replace) session data with fresh JSON."""
    try:
        safe = jsonable_encoder(data)
        await redis.set(session_id, json.dumps(safe), ex=expire_seconds)
        log.info(f"Session {session_id} updated.")
    except Exception as e:
        log.error(f"Error updating session {session_id}: {e}", exc_info=True)
        raise

async def delete_session(session_id: str):
    """Delete a session entirely."""
    try:
        result = await redis.delete(session_id)
        if result:
            log.info(f"Session {session_id} deleted.")
            return True
    except Exception as e:
        log.error(f"Error deleting session {session_id}: {e}", exc_info=True)
        raise
    return False