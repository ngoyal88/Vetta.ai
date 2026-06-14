from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


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


class SessionStatusEvent(BaseModel):
    type: Literal["session_status"] = "session_status"
    status: Literal["active", "ended"]
    completion_reason: Optional[str] = None
    final_feedback: Optional[str] = None
    full: Optional[Dict[str, Any]] = None


class InterviewEndedEvent(BaseModel):
    type: Literal["interview_ended"] = "interview_ended"
    completion_reason: str
    duration_minutes: int = Field(ge=0)
    questions_answered: int = Field(ge=0)
    timestamp: str


class SessionStateMachine:
    TERMINAL = {
        SessionLifecycleState.ENDED_EARLY,
        SessionLifecycleState.COMPLETED,
        SessionLifecycleState.INCOMPLETE_EXIT,
    }

    @classmethod
    def transition(
        cls,
        current_state: str,
        event: SessionEvent,
    ) -> SessionLifecycleState:
        state = SessionLifecycleState(current_state or SessionLifecycleState.ACTIVE.value)
        if state in cls.TERMINAL:
            return state
        if event.type in {
            SessionEventType.SILENCE_TIMEOUT,
            SessionEventType.MANUAL_END,
            SessionEventType.ERROR_END,
            SessionEventType.TAB_AWAY_TIMEOUT,
            SessionEventType.MAX_DURATION,
        }:
            return SessionLifecycleState.ENDED_EARLY
        if event.type == SessionEventType.DISCONNECT_TIMEOUT:
            return SessionLifecycleState.INCOMPLETE_EXIT
        if event.type == SessionEventType.COMPLETE:
            return SessionLifecycleState.COMPLETED
        return SessionLifecycleState.ACTIVE
