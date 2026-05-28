from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from config import get_settings
from models.interview import InterviewType


@dataclass(frozen=True)
class ModeCapabilities:
    requires_resume: bool = False
    supports_observer: bool = False
    supports_seeded_plan: bool = False
    enabled: bool = True


def _feature_flag(name: str, default: bool = False) -> bool:
    settings = get_settings()
    return bool(getattr(settings, name, default))


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
