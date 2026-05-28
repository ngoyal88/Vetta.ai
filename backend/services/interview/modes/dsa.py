from __future__ import annotations

from models.interview import InterviewType
from services.interview.modes.base import InterviewModeStrategy


class DsaModeStrategy(InterviewModeStrategy):
    mode = InterviewType.DSA
