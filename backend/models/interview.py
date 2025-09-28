from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime,timezone


class InterviewState(BaseModel):
    session_id: str
    interview_type: str
    questions: Optional[list[Dict[str, Any]]] = []
    current_question_index: int = 0
    answers: Optional[Dict[int, Any]] = {}
    started_at: datetime = datetime.now(timezone.utc)
    last_updated: datetime = datetime.now(timezone.utc)
