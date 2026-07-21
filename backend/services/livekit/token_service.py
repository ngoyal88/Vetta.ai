"""LiveKit token generation service."""
from __future__ import annotations

import json
from datetime import timedelta
from typing import Any, Dict, Optional

from config import get_settings
from utils.session_access import require_session_owner

settings = get_settings()


def livekit_token_ttl() -> timedelta:
    session_seconds = int(getattr(settings, "interview_session_ttl_seconds", 7200))
    return timedelta(seconds=session_seconds + 300)


def agent_name() -> str:
    return (getattr(settings, "livekit_agent_name", "") or "vetta-interviewer").strip()


def dispatch_metadata(session_id: str, uid: str) -> str:
    return json.dumps({"session_id": session_id, "user_id": uid})


def resolve_owned_session(session_data: Optional[Dict[str, Any]], uid: str) -> Dict[str, Any]:
    return require_session_owner(session_data, uid)


def livekit_api():
    from livekit import api as lk_api
    return lk_api
