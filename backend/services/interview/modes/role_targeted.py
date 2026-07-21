from __future__ import annotations

from typing import Any, Dict, Optional

from models.interview import InterviewType
from services.interview.jd_context_service import clean_optional_text
from services.interview.modes.base import InterviewModeStrategy, ModeStartResult
from services.interview.modes.start_configs import ModeStartConfig, RoleTargetedStartConfig


class RoleTargetedModeStrategy(InterviewModeStrategy):
    mode = InterviewType.ROLE_TARGETED

    async def prepare_start(
        self,
        *,
        interview_service: Any,
        difficulty,
        resume_data: Dict[str, Any],
        years_experience: Optional[int],
        config: ModeStartConfig,
    ) -> ModeStartResult:
        if not isinstance(config, RoleTargetedStartConfig):
            raise TypeError("RoleTargetedModeStrategy requires RoleTargetedStartConfig")

        target_company = clean_optional_text(config.target_company, max_len=120)
        target_role = clean_optional_text(config.target_role, max_len=160)
        job_description = clean_optional_text(config.job_description, max_len=8000)
        interview_focus = config.interview_focus

        jd_fit_context = await interview_service.build_jd_fit_context(
            target_company=target_company,
            target_role=target_role or "",
            job_description=job_description or "",
            interview_focus=interview_focus,
            resume_data=resume_data,
            years_experience=years_experience,
        )
        target_context = {
            "target_company": target_company,
            "target_role": target_role,
            "job_description": job_description,
            "interview_focus": interview_focus,
            "jd_fit_context": jd_fit_context,
        }
        return ModeStartResult(
            target_context=target_context,
            jd_fit_context=jd_fit_context,
            resume_probe_context={},
            seeded_questions=[],
        )
