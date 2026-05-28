from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

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


class ModeTargetContext(BaseModel):
    target_company: Optional[str] = None
    target_role: Optional[str] = None
    job_description: Optional[str] = None
    interview_focus: Optional[str] = None
    jd_fit_context: Optional[JdFitContext] = None
    resume_probe_context: Optional[ResumeProbeContext] = None

    def to_prompt_context(self) -> Dict[str, Any]:
        data = self.model_dump(exclude_none=True)
        if "jd_fit_context" in data and isinstance(data["jd_fit_context"], dict):
            data["jd_fit_context"] = JdFitContext(**data["jd_fit_context"]).model_dump()
        if "resume_probe_context" in data and isinstance(data["resume_probe_context"], dict):
            data["resume_probe_context"] = ResumeProbeContext(**data["resume_probe_context"]).model_dump()
        return data
