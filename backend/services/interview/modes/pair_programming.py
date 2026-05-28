from __future__ import annotations

from models.interview import InterviewType
from services.interview.modes.base import InterviewModeStrategy


class PairProgrammingModeStrategy(InterviewModeStrategy):
    mode = InterviewType.PAIR_PROGRAMMING
