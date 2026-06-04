"""Safe HTTP error helpers — never leak internal exception text to clients."""

from logging import Logger
from typing import NoReturn

from fastapi import HTTPException


def raise_internal_error(
    logger: Logger,
    exc: BaseException,
    *,
    message: str = "Internal server error",
) -> NoReturn:
    """Log full exception server-side; raise a generic 500 to the client."""
    logger.error("%s", message, exc_info=exc)
    raise HTTPException(status_code=500, detail=message)
