import asyncio
import time

from fastapi import HTTPException, Request, status

from utils.logger import get_logger
from utils.redis_client import redis

_log = get_logger(__name__)
_REDIS_RATE_LIMIT_TIMEOUT_SEC = 2.0


async def _increment_rate_bucket(bucket: str, limit: int, window_seconds: int) -> None:
    try:
        current = await asyncio.wait_for(redis.incr(bucket), timeout=_REDIS_RATE_LIMIT_TIMEOUT_SEC)
        if current == 1:
            await asyncio.wait_for(
                redis.expire(bucket, window_seconds),
                timeout=_REDIS_RATE_LIMIT_TIMEOUT_SEC,
            )
        if current > limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        _log.warning("Rate limit skipped — Redis timed out for bucket %s", bucket)
    except Exception as exc:
        _log.warning("Rate limit skipped — Redis error: %s", exc)

def client_ip_from_request(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def check_rate_limit_ip(
    request: Request,
    key: str,
    limit: int = 5,
    window_seconds: int = 3600,
) -> None:
    """Per-IP rate limit for unauthenticated public endpoints."""
    ip = client_ip_from_request(request)
    bucket = f"rate:ip:{ip}:{key}:{int(time.time() // window_seconds)}"
    await _increment_rate_bucket(bucket, limit, window_seconds)


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
    await _increment_rate_bucket(bucket, limit, window_seconds)
