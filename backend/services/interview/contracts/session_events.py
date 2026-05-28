from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class SessionLifecycleState(str, Enum):
    ACTIVE = "active"
    ENDED_EARLY = "ended_early"
    COMPLETED = "completed"
    INCOMPLETE_EXIT = "incomplete_exit"


class SessionEventType(str, Enum):
    START = "start"
    ANSWER_RECEIVED = "answer_received"
    SILENCE_TIMEOUT = "silence_timeout"
    MANUAL_END = "manual_end"
    DISCONNECT_TIMEOUT = "disconnect_timeout"
    COMPLETE = "complete"
    ERROR_END = "error_end"
    TAB_AWAY_TIMEOUT = "tab_away_timeout"
    MAX_DURATION = "max_duration"


class SessionEvent(BaseModel):
    type: SessionEventType
    reason: Optional[str] = None
