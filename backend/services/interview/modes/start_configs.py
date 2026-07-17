"""Start interview request — common core + mode-specific config (discriminated union)."""
from __future__ import annotations

from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models.interview import DifficultyLevel, InterviewType
from services.interview.modes.constants import INTERVIEW_FOCUS_VALUES


class StartInterviewBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    candidate_name: Optional[str] = None
    years_experience: Optional[int] = Field(None, ge=0, le=50)
    resume_data: Optional[dict] = None


class RoleTargetedStartConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_role: str = Field(..., min_length=1)
    job_description: Optional[str] = None
    interview_focus: str = "mixed"
    target_company: Optional[str] = None
    jd_fit_snapshot_id: Optional[str] = None

    @field_validator("interview_focus")
    @classmethod
    def validate_interview_focus(cls, value: str) -> str:
        normalized = (value or "mixed").strip().lower().replace(" ", "_")
        if normalized not in INTERVIEW_FOCUS_VALUES:
            raise ValueError(
                "interview_focus must be one of: mixed, technical, behavioral, system_design, dsa"
            )
        return normalized


class ResumeStartConfig(BaseModel):
    """Resume deep-dive uses Vault profile server-side; no client config fields."""

    model_config = ConfigDict(extra="forbid")


class PairProgrammingStartConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    track: str = "dsa"
    session_focus: Optional[str] = None


class PressureStartConfig(BaseModel):
    """Stub until Pressure mode ships."""

    model_config = ConfigDict(extra="forbid")


class BlindStartConfig(BaseModel):
    """Stub until Blind mode ships."""

    model_config = ConfigDict(extra="forbid")


class StartRoleTargetedRequest(StartInterviewBase):
    interview_type: Literal[InterviewType.ROLE_TARGETED] = InterviewType.ROLE_TARGETED
    config: RoleTargetedStartConfig


class StartResumeRequest(StartInterviewBase):
    interview_type: Literal[InterviewType.RESUME_BASED] = InterviewType.RESUME_BASED
    config: ResumeStartConfig = Field(default_factory=ResumeStartConfig)


class StartPairProgrammingRequest(StartInterviewBase):
    interview_type: Literal[InterviewType.PAIR_PROGRAMMING] = InterviewType.PAIR_PROGRAMMING
    config: PairProgrammingStartConfig = Field(default_factory=PairProgrammingStartConfig)


class StartPressureRequest(StartInterviewBase):
    interview_type: Literal[InterviewType.PRESSURE] = InterviewType.PRESSURE
    config: PressureStartConfig = Field(default_factory=PressureStartConfig)


class StartBlindRequest(StartInterviewBase):
    interview_type: Literal[InterviewType.BLIND] = InterviewType.BLIND
    config: BlindStartConfig = Field(default_factory=BlindStartConfig)


StartInterviewRequest = Annotated[
    Union[
        StartRoleTargetedRequest,
        StartResumeRequest,
        StartPairProgrammingRequest,
        StartPressureRequest,
        StartBlindRequest,
    ],
    Field(discriminator="interview_type"),
]

ModeStartConfig = Union[
    RoleTargetedStartConfig,
    ResumeStartConfig,
    PairProgrammingStartConfig,
    PressureStartConfig,
    BlindStartConfig,
]
