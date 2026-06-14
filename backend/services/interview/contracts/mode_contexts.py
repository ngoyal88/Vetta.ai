from __future__ import annotations

from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field


ProbeTargetKind = Literal["role", "project", "achievement", "weak_area"]


class ProbeTarget(BaseModel):
    id: str
    kind: ProbeTargetKind
    label: str
    detail: str
    resume_ref: str


class ResumeProbeContext(BaseModel):
    summary: str = ""
    probe_targets: List[ProbeTarget] = Field(default_factory=list)
    probing_areas: List[str] = Field(default_factory=list)
    interview_plan: List[str] = Field(default_factory=list)
    candidate_strengths: List[str] = Field(default_factory=list)
    candidate_gaps: List[str] = Field(default_factory=list)


class JdFitContext(BaseModel):
    required_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    candidate_strengths: List[str] = Field(default_factory=list)
    candidate_gaps: List[str] = Field(default_factory=list)
    probing_areas: List[str] = Field(default_factory=list)
    interview_plan: List[str] = Field(default_factory=list)
    summary: str = ""
