"""Logging setup with optional Rich console or JSON output."""
from __future__ import annotations

import logging
import sys
from functools import lru_cache
from typing import Optional

from config import get_settings

settings = get_settings()
_LOG_LEVEL = settings.log_level.upper()


def _console_handler() -> logging.Handler:
    try:
        from rich.logging import RichHandler
        from rich.console import Console

        return RichHandler(
            console=Console(),
            show_time=True,
            show_path=False,
            markup=False,
            rich_tracebacks=True,
        )
    except ModuleNotFoundError:
        return logging.StreamHandler(sys.stdout)


def _json_handler() -> logging.Handler:
    try:
        from pythonjsonlogger import jsonlogger
    except ModuleNotFoundError:
        raise SystemExit(
            "LOG_FORMAT=json requires python-json-logger. Run: pip install python-json-logger"
        )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(jsonlogger.JsonFormatter())
    return handler


def setup_logging(force: bool = False) -> None:
    """Configure root logger and uvicorn loggers from settings."""
    root = logging.getLogger()
    if root.handlers and not force:
        return

    for h in list(root.handlers):
        root.removeHandler(h)

    root.setLevel(_LOG_LEVEL)
    handler = _json_handler() if settings.log_format.lower() == "json" else _console_handler()
    root.addHandler(handler)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = [handler]
        lg.setLevel(_LOG_LEVEL)


@lru_cache()
def get_logger(name: Optional[str] = None) -> logging.Logger:
    setup_logging()
    return logging.getLogger(name or "vetta-ai")
