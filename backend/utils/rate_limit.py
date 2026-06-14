import asyncio
import ipaddress
import time

from fastapi import HTTPException, Request, status

from config import get_settings
from utils.logger import get_logger
from utils.redis_client import get_redis

_log = get_logger(__name__)
_REDIS_RATE_LIMIT_TIMEOUT_SEC = 2.0


def _client_ip_is_trusted(remote_ip: str, trusted_ips: list[str]) -> bool:
    if not remote_ip or not trusted_ips:
        return False
    try:
        remote = ipaddress.ip_address(remote_ip)
    except ValueError:
        return False
    for entry in trusted_ips:
        try:
            if "/" in entry:
                if remote in ipaddress.ip_network(entry, strict=False):
                    return True
            elif remote == ipaddress.ip_address(entry):
                return True
        except ValueError:
            continue
    return False


def client_ip_from_request(request: Request) -> str:
    """Resolve client IP; honor proxy headers only from trusted upstreams."""
    settings = get_settings()
    remote = request.client.host if request.client else ""

    if settings.trust_proxy_headers and _client_ip_is_trusted(remote, settings.trusted_proxy_ips_list()):
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()

    return remote or "unknown"


async def _increment_rate_bucket(bucket: str, limit: int, window_seconds: int) -> None:
    fail_open = get_settings().rate_limit_should_fail_open()
    try:
        client = await get_redis()
        current = await asyncio.wait_for(client.incr(bucket), timeout=_REDIS_RATE_LIMIT_TIMEOUT_SEC)
        if current == 1:
            await asyncio.wait_for(
                client.expire(bucket, window_seconds),
                timeout=_REDIS_RATE_LIMIT_TIMEOUT_SEC,
            )
        if current > limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        _log.warning("Rate limit Redis timed out for bucket %s", bucket)
        if not fail_open:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Service temporarily unavailable",
            ) from None
    except Exception as exc:
        _log.warning("Rate limit Redis error for bucket %s: %s", bucket, exc)
        if not fail_open:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Service temporarily unavailable",
            ) from exc


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
    """Enforce a simple per-UID rate limit using Redis."""
    if not uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized")

    bucket = f"rate:{uid}:{key}:{int(time.time() // window_seconds)}"
    await _increment_rate_bucket(bucket, limit, window_seconds)
