"""HTTP error helpers — safe client messages; optional detail in local dev."""
from __future__ import annotations

from logging import Logger
from typing import NoReturn

from fastapi import HTTPException

from config import get_settings


def client_error_detail(message: str, exc: BaseException | None = None) -> str:
    """Return a safe client message; append exception info when dev exposure is enabled."""
    if exc is None or not get_settings().expose_api_error_details():
        return message
    exc_text = str(exc).strip() or exc.__class__.__name__
    return f"{message}: {exc.__class__.__name__}: {exc_text}"


def upstream_unavailable_status(exc: BaseException, *, default: int = 500) -> int:
    """Map upstream rate limits / overload to 503."""
    message = str(exc).lower()
    if "429" in message or "rate limit" in message or "too many requests" in message:
        return 503
    return default


def json_error_content(detail: object) -> dict[str, object]:
    if isinstance(detail, (str, int, float, bool)):
        return {"detail": detail}
    return {"detail": detail}


def raise_internal_error(
    logger: Logger,
    exc: BaseException,
    *,
    message: str = "Internal server error",
) -> NoReturn:
    """Log full exception server-side; raise 500 with optional detail in local dev."""
    logger.error("%s", message, exc_info=exc)
    raise HTTPException(status_code=500, detail=client_error_detail(message, exc))


def raise_service_error(
    logger: Logger,
    exc: BaseException,
    *,
    message: str,
    log_event: str,
    default_status: int = 500,
) -> NoReturn:
    """Log a failed service step and raise HTTPException with dev-safe detail."""
    logger.exception("%s", log_event)
    raise HTTPException(
        status_code=upstream_unavailable_status(exc, default=default_status),
        detail=client_error_detail(message, exc),
    ) from exc
