import time
from fastapi import HTTPException, status
from utils.redis_client import redis


async def check_rate_limit(uid: str, key: str, limit: int = 60, window_seconds: int = 60):
    """Enforce a simple per-UID rate limit using Redis.

    Args:
        uid: Authenticated user id.
        key: Action key (e.g., "start", "complete").
        limit: Max number of allowed hits in the window.
        window_seconds: Window duration in seconds.
    Raises:
        HTTPException 429 when over limit.
    """
    if not uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized")

    bucket = f"rate:{uid}:{key}:{int(time.time() // window_seconds)}"
    try:
        current = await redis.incr(bucket)
        if current == 1:
            await redis.expire(bucket, window_seconds)
        if current > limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")
    except HTTPException:
        raise
    except Exception:
        # Fail open on Redis issues to avoid blocking; log upstream.
        return
