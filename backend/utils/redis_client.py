import os
import json
from fastapi.encoders import jsonable_encoder
from redis.asyncio import Redis
from utils.logger import get_logger

log = get_logger(__name__)

# ------------------------------------------------------------------ #
# Redis client init
# ------------------------------------------------------------------ #
redis = Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=True,
)

# ------------------------------------------------------------------ #
# Connection test
# ------------------------------------------------------------------ #
async def test_connection():
    try:
        pong = await redis.ping()
        if pong:
            log.info("✅ Redis connection successful!")
            return True
    except Exception as e:
        log.error(f"❌ Redis connection failed: {e}", exc_info=True)
    return False

# ------------------------------------------------------------------ #
# Session management (all JSON-based)
# ------------------------------------------------------------------ #
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