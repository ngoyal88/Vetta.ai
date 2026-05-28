from __future__ import annotations

from models.interview import InterviewType
from services.interview.modes.base import InterviewModeStrategy
from services.interview.modes.blind import BlindModeStrategy
from services.interview.modes.default_behavioral import DefaultBehavioralModeStrategy
from services.interview.modes.dsa import DsaModeStrategy
from services.interview.modes.pair_programming import PairProgrammingModeStrategy
from services.interview.modes.pressure import PressureModeStrategy
from services.interview.modes.resume_deep_dive import ResumeDeepDiveModeStrategy
from services.interview.modes.role_targeted import RoleTargetedModeStrategy


class ModeStrategyRegistry:
    def __init__(self) -> None:
        self._strategies: dict[InterviewType, InterviewModeStrategy] = {
            InterviewType.ROLE_TARGETED: RoleTargetedModeStrategy(),
            InterviewType.RESUME_BASED: ResumeDeepDiveModeStrategy(),
            InterviewType.DSA: DsaModeStrategy(),
            InterviewType.BEHAVIORAL: DefaultBehavioralModeStrategy(),
            InterviewType.PRESSURE: PressureModeStrategy(),
            InterviewType.BLIND: BlindModeStrategy(),
            InterviewType.PAIR_PROGRAMMING: PairProgrammingModeStrategy(),
        }
        default = DefaultBehavioralModeStrategy()
        self._strategies.setdefault(InterviewType.FRONTEND, default)
        self._strategies.setdefault(InterviewType.BACKEND, default)
        self._strategies.setdefault(InterviewType.CORE_CS, default)
        self._strategies.setdefault(InterviewType.CUSTOM, default)

    def get(self, interview_type: InterviewType) -> InterviewModeStrategy:
        return self._strategies.get(interview_type, self._strategies[InterviewType.BEHAVIORAL])
