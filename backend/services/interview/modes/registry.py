from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from config import get_settings
from models.interview import InterviewType
from services.interview.modes.base import InterviewModeStrategy, ModeStartResult
from services.interview.modes.resume_deep_dive import ResumeDeepDiveModeStrategy
from services.interview.modes.role_targeted import RoleTargetedModeStrategy


@dataclass(frozen=True)
class ModeCapabilities:
    requires_resume: bool = False
    supports_observer: bool = False
    supports_seeded_plan: bool = False
    enabled: bool = True


def _feature_flag(name: str, default: bool = False) -> bool:
    return bool(getattr(get_settings(), name, default))


MODE_CAPABILITIES: Dict[InterviewType, ModeCapabilities] = {
    InterviewType.ROLE_TARGETED: ModeCapabilities(requires_resume=False, supports_seeded_plan=False, enabled=True),
    InterviewType.RESUME_BASED: ModeCapabilities(requires_resume=True, supports_seeded_plan=True, enabled=True),
    InterviewType.DSA: ModeCapabilities(requires_resume=False, supports_seeded_plan=False, enabled=True),
    InterviewType.BEHAVIORAL: ModeCapabilities(requires_resume=False, supports_seeded_plan=False, enabled=True),
    InterviewType.FRONTEND: ModeCapabilities(requires_resume=False, supports_seeded_plan=False, enabled=True),
    InterviewType.BACKEND: ModeCapabilities(requires_resume=False, supports_seeded_plan=False, enabled=True),
    InterviewType.CORE_CS: ModeCapabilities(requires_resume=False, supports_seeded_plan=False, enabled=True),
    InterviewType.CUSTOM: ModeCapabilities(requires_resume=False, supports_seeded_plan=False, enabled=True),
    InterviewType.PRESSURE: ModeCapabilities(enabled=_feature_flag("enable_pressure_mode", False)),
    InterviewType.BLIND: ModeCapabilities(enabled=_feature_flag("enable_blind_mode", False)),
    InterviewType.PAIR_PROGRAMMING: ModeCapabilities(
        supports_observer=True,
        enabled=_feature_flag("enable_pair_programming_mode", False),
    ),
}


def get_mode_capabilities(mode: InterviewType) -> ModeCapabilities:
    return MODE_CAPABILITIES.get(mode, ModeCapabilities(enabled=False))


class ModeStrategyRegistry:
    def __init__(self) -> None:
        self._strategies: dict[InterviewType, InterviewModeStrategy] = {
            InterviewType.ROLE_TARGETED: RoleTargetedModeStrategy(),
            InterviewType.RESUME_BASED: ResumeDeepDiveModeStrategy(),
            InterviewType.DSA: InterviewModeStrategy(),
            InterviewType.BEHAVIORAL: InterviewModeStrategy(),
            InterviewType.PRESSURE: InterviewModeStrategy(),
            InterviewType.BLIND: InterviewModeStrategy(),
            InterviewType.PAIR_PROGRAMMING: InterviewModeStrategy(),
            InterviewType.FRONTEND: InterviewModeStrategy(),
            InterviewType.BACKEND: InterviewModeStrategy(),
            InterviewType.CORE_CS: InterviewModeStrategy(),
            InterviewType.CUSTOM: InterviewModeStrategy(),
        }

    def get(self, interview_type: InterviewType) -> InterviewModeStrategy:
        return self._strategies.get(interview_type, self._strategies[InterviewType.BEHAVIORAL])
