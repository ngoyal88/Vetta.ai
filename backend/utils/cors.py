"""CORS header helpers for exception-handler responses.

CORSMiddleware covers normal route responses. Custom exception handlers return
JSONResponse directly; attach these headers there so browsers can read error bodies.
"""
from __future__ import annotations

import re
from typing import Optional

from config import get_settings

_origin_regex: Optional[re.Pattern[str]] = None


def _origin_allowed(origin: str) -> bool:
    global _origin_regex
    if not origin:
        return False

    settings = get_settings()
    if origin in settings.allowed_origins_list():
        return True

    pattern = settings.allowed_origin_regex_value()
    if not pattern:
        return False

    if _origin_regex is None or _origin_regex.pattern != pattern:
        _origin_regex = re.compile(pattern)
    return bool(_origin_regex.fullmatch(origin))


def apply_cors_headers(response, origin: str) -> None:
    if origin and _origin_allowed(origin):
        response.headers.setdefault("Access-Control-Allow-Origin", origin)
        response.headers.setdefault("Access-Control-Allow-Credentials", "true")
        response.headers.setdefault("Vary", "Origin")
