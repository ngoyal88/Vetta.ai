from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ScorePoint(BaseModel):
    version_number: int
    score: int = Field(ge=0, le=100)
    created_at: datetime


class VaultScorecard(BaseModel):
    score: int = Field(ge=0, le=100)
    coverage_counts: Dict[str, int]
    summary_line: str
    role_fit_score: Optional[int] = Field(default=None, ge=0, le=100)
    role_fit_role: Optional[str] = None
    ats_flags: List[str] = Field(default_factory=list)
    weak_areas: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    last_analyzed_at: datetime


class ResumeVersion(BaseModel):
    id: str
    resume_id: str
    version_number: int
    created_at: datetime
    user_note: str = ""
    score_at_version: Optional[int] = Field(default=None, ge=0, le=100)
    diff_summary: Optional[str] = None
    profile_snapshot: Dict[str, Any]


class VaultEntry(BaseModel):
    id: str
    user_id: str
    name: str
    tags: List[str] = Field(default_factory=list)
    is_active: bool = False
    created_at: datetime
    last_updated: datetime
    current_version_id: Optional[str] = None
    version_count: int = 0
    scorecard: Optional[VaultScorecard] = None
    score_history: List[ScorePoint] = Field(default_factory=list)
    interview_session_ids: List[str] = Field(default_factory=list)
    avg_interview_score: Optional[float] = None
