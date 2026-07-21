from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, FrozenSet, Optional, Union

from config import get_settings
from fastapi import HTTPException
from models.interview import InterviewType
from services.interview.modes.base import InterviewModeStrategy
from services.interview.modes.resume_deep_dive import ResumeDeepDiveModeStrategy
from services.interview.modes.role_targeted import RoleTargetedModeStrategy


@dataclass(frozen=True)
class ModeCapabilities:
    requires_resume: bool = False
    supports_observer: bool = False
    supports_seeded_plan: bool = False
    supports_coding: bool = False
    enabled: bool = True


def _feature_flag(name: str, default: bool = False) -> bool:
    return bool(getattr(get_settings(), name, default))


# Live catalog: Role-Targeted + Resume Deep-Dive + Pair Programming.
LIVE_STARTABLE_TYPES: FrozenSet[InterviewType] = frozenset(
    {
        InterviewType.ROLE_TARGETED,
        InterviewType.RESUME_BASED,
        InterviewType.PAIR_PROGRAMMING,
    }
)

MODE_CAPABILITIES: Dict[InterviewType, ModeCapabilities] = {
    InterviewType.ROLE_TARGETED: ModeCapabilities(
        requires_resume=False, supports_seeded_plan=False, enabled=True
    ),
    InterviewType.RESUME_BASED: ModeCapabilities(
        requires_resume=True, supports_seeded_plan=True, enabled=True
    ),
    InterviewType.PAIR_PROGRAMMING: ModeCapabilities(
        supports_observer=True,
        supports_coding=True,
        enabled=True,
    ),
    InterviewType.PRESSURE: ModeCapabilities(
        enabled=_feature_flag("enable_pressure_mode", False)
    ),
    InterviewType.BLIND: ModeCapabilities(
        enabled=_feature_flag("enable_blind_mode", False)
    ),
}


def get_mode_capabilities(mode: InterviewType) -> ModeCapabilities:
    return MODE_CAPABILITIES.get(mode, ModeCapabilities(enabled=False))


# UI catalog slug (frontend modeContract catalogSlug) per API interview type.
_CATALOG_SLUG_BY_TYPE: Dict[InterviewType, str] = {
    InterviewType.ROLE_TARGETED: "role_targeted",
    InterviewType.RESUME_BASED: "resume_deep_dive",
    InterviewType.PAIR_PROGRAMMING: "pair_programming",
    InterviewType.PRESSURE: "pressure",
    InterviewType.BLIND: "blind",
}

_MODE_LABEL_BY_TYPE: Dict[InterviewType, str] = {
    InterviewType.ROLE_TARGETED: "Role-Targeted Interview",
    InterviewType.RESUME_BASED: "Resume Deep-Dive",
    InterviewType.PAIR_PROGRAMMING: "Pair Programming",
    InterviewType.PRESSURE: "Pressure Mode",
    InterviewType.BLIND: "Blind Mode",
}


def is_startable_interview_type(mode: InterviewType) -> bool:
    """Live catalog gate: type must be in LIVE_STARTABLE_TYPES and enabled."""
    if mode not in LIVE_STARTABLE_TYPES:
        return False
    return get_mode_capabilities(mode).enabled


def get_mode_metadata(mode: InterviewType) -> Dict[str, Any]:
    """Stable metadata for API responses; aligns with frontend modeContract."""
    caps = get_mode_capabilities(mode)
    return {
        "api_type": mode.value,
        "catalog_slug": _CATALOG_SLUG_BY_TYPE.get(mode, mode.value),
        "label": _MODE_LABEL_BY_TYPE.get(mode, "Interview session"),
        "supports_coding": caps.supports_coding,
        "startable": is_startable_interview_type(mode),
        "enabled": caps.enabled,
    }


def parse_interview_type(
    val: str | None,
    *,
    default: InterviewType = InterviewType.ROLE_TARGETED,
) -> InterviewType:
    """Parse InterviewType from session/API strings. Prefer role_targeted on unknown."""
    if not val:
        return default
    try:
        return InterviewType(val)
    except Exception:
        pass
    v = str(val).strip().lower()
    for it in InterviewType:
        if it.name.lower() == v or str(it.value).lower() == v:
            return it
    return default


def is_coding_interview_type(
    val: Union[str, InterviewType, None] = None,
) -> bool:
    """True when the interview type may use coding APIs / IDE / code control messages."""
    if val is None:
        return False
    if isinstance(val, InterviewType):
        return get_mode_capabilities(val).supports_coding
    raw = str(val).strip().lower()
    mode: Optional[InterviewType] = None
    try:
        mode = InterviewType(raw)
    except Exception:
        for it in InterviewType:
            if it.name.lower() == raw or str(it.value).lower() == raw:
                mode = it
                break
    if mode is None:
        return False
    return get_mode_capabilities(mode).supports_coding


def require_coding_session(session_data: Optional[Dict[str, Any]]) -> None:
    """Raise HTTP 403 unless the session interview type supports coding."""
    if not session_data or not isinstance(session_data, dict):
        raise HTTPException(404, "Session not found")
    if not is_coding_interview_type(session_data.get("interview_type")):
        raise HTTPException(
            403,
            "Code execution is only available in coding interview modes.",
        )


class ModeStrategyRegistry:
    def __init__(self) -> None:
        # Late import avoids circular import with pair_programming strategy.
        from services.interview.modes.pair_programming import PairProgrammingModeStrategy

        self._strategies: dict[InterviewType, InterviewModeStrategy] = {
            InterviewType.ROLE_TARGETED: RoleTargetedModeStrategy(),
            InterviewType.RESUME_BASED: ResumeDeepDiveModeStrategy(),
            InterviewType.PAIR_PROGRAMMING: PairProgrammingModeStrategy(),
            InterviewType.PRESSURE: InterviewModeStrategy(),
            InterviewType.BLIND: InterviewModeStrategy(),
        }

    def get(self, interview_type: InterviewType) -> InterviewModeStrategy:
        return self._strategies.get(
            interview_type, self._strategies[InterviewType.ROLE_TARGETED]
        )
