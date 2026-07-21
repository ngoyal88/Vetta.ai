from __future__ import annotations

from typing import Any, Dict, Optional

from models.interview import InterviewType
from services.interview.modes.base import InterviewModeStrategy, ModeStartResult
from services.interview.modes.start_configs import ModeStartConfig


class ResumeDeepDiveModeStrategy(InterviewModeStrategy):
    mode = InterviewType.RESUME_BASED

    async def prepare_start(
        self,
        *,
        interview_service: Any,
        difficulty,
        resume_data: Dict[str, Any],
        years_experience: Optional[int],
        config: ModeStartConfig,
    ) -> ModeStartResult:
        resume_probe_context = interview_service.build_resume_probe_context(
            resume_data=resume_data,
            years_experience=years_experience,
        )
        target_context = {
            "resume_probe_context": resume_probe_context,
        }
        context = interview_service._build_context(
            self.mode,
            resume_data,
            None,
            years_experience,
            target_context=target_context,
        )
        seeded_questions = await interview_service.generate_resume_deep_dive_questions(
            difficulty=difficulty,
            context=context,
            probe_targets=resume_probe_context.get("probe_targets") or [],
            count=3,
        )
        return ModeStartResult(
            target_context=target_context,
            jd_fit_context={},
            resume_probe_context=resume_probe_context,
            seeded_questions=seeded_questions,
        )
