from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from models.interview import DifficultyLevel, InterviewType


@dataclass
class ModeStartResult:
    target_context: Optional[Dict[str, Any]]
    jd_fit_context: Dict[str, Any]
    resume_probe_context: Dict[str, Any]
    seeded_questions: List[Dict[str, Any]]


class InterviewModeStrategy:
    mode: InterviewType

    async def prepare_start(
        self,
        *,
        interview_service: Any,
        difficulty: DifficultyLevel,
        resume_data: Dict[str, Any],
        custom_role: Optional[str],
        years_experience: Optional[int],
        target_company: Optional[str],
        target_role: Optional[str],
        job_description: Optional[str],
        interview_focus: Optional[str],
    ) -> ModeStartResult:
        return ModeStartResult(
            target_context=None,
            jd_fit_context={},
            resume_probe_context={},
            seeded_questions=[],
        )
