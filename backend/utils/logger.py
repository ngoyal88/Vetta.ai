"""
Unified logging utility.

• console (default) → colourised RichHandler  
• json              → machine-friendly logs for Docker/K8s
"""

from __future__ import annotations

import logging
import os
import sys
from functools import lru_cache

from config import Settings  # make sure settings is properly loaded

# ---------------------------- #
# Build handlers based on environment settings
# ---------------------------- #


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
        # fallback to default stream handler if rich is not installed
        return logging.StreamHandler(sys.stdout)


def _json_handler() -> logging.Handler:
    try:
        from pythonjsonlogger import jsonlogger
    except ModuleNotFoundError:
        raise SystemExit(
            "LOG_FORMAT=json but package python-json-logger not installed.\n"
            "Run: pip install python-json-logger"
        )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(jsonlogger.JsonFormatter())
    return handler


def setup_logging(force: bool = False) -> None:
    """
    Set up logging based on environment configuration.
    If 'force' is True, reconfigure even if handlers exist.
    """
    root = logging.getLogger()

    if root.handlers and not force:
        return

    # Clear existing handlers
    for h in list(root.handlers):
        root.removeHandler(h)

    # Set log level from settings, fallback to INFO if not set
    log_level = Settings.log_level.upper() if hasattr(Settings, "log_level") else "INFO"
    root.setLevel(log_level)

    # Choose handler type based on settings
    handler = _json_handler() if getattr(Settings, "log_format", "").lower() == "json" else _console_handler()
    root.addHandler(handler)

    # Ensure uvicorn logs use the same handler and level
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers = [handler]
        logger.setLevel(log_level)


@lru_cache()
def get_logger(name: str | None = None) -> logging.Logger:
    """
    Return a logger with the given name.
    Uses cached setup_logging to avoid reinitializing handlers.
    """
    setup_logging()
    return logging.getLogger(name or "ai-interviewer")
