from pydantic import BaseModel
from typing import Optional
from datetime import datetime,timezone

class SessionData(BaseModel):
    user: str
    role: str
    interview_type: Optional[str] = None
    started_at: datetime = datetime.now(timezone.utc)
