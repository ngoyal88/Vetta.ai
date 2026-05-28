from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


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
