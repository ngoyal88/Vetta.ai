import json
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from pydantic import BaseModel, Field


def normalize_vault_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("name_blank")
    return normalized


def _coerce_tag_values(raw: Any) -> Iterable[Any]:
    if raw is None:
        return []
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []
        if text.startswith("["):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                return parsed
        return text.split(",")
    if isinstance(raw, (list, tuple, set)):
        return raw
    raise ValueError("tags_invalid")


def normalize_vault_tags(raw: Any) -> List[str]:
    normalized: List[str] = []
    seen: set[str] = set()
    for item in _coerce_tag_values(raw):
        if item is None:
            continue
        if not isinstance(item, str):
            raise ValueError("tags_invalid")
        text = " ".join(item.split()).strip()
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(text)
    return normalized


def normalize_vault_tag_list(raw: Any) -> List[str]:
    if not isinstance(raw, list):
        raise ValueError("tags_invalid")

    for item in raw:
        if not isinstance(item, str):
            raise ValueError("tags_invalid")

    return normalize_vault_tags(raw)


class ScorePoint(BaseModel):
    version_number: int
    score: int = Field(ge=0, le=100)
    created_at: datetime
    version_id: Optional[str] = None
    action: Optional[str] = None
    role: Optional[str] = None


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
    latest_score: Optional[int] = Field(default=None, ge=0, le=100)
    diff_summary: Optional[str] = None
    profile_snapshot: Dict[str, Any]
    source_filename: Optional[str] = None
    content_type: Optional[str] = None
    has_source_file: bool = False


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
