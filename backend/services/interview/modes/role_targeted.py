from __future__ import annotations

from typing import Any, Dict, Optional

from models.interview import InterviewType
from services.interview.modes.base import InterviewModeStrategy, ModeStartResult


class RoleTargetedModeStrategy(InterviewModeStrategy):
    mode = InterviewType.ROLE_TARGETED

    async def prepare_start(
        self,
        *,
        interview_service: Any,
        difficulty,
        resume_data: Dict[str, Any],
        custom_role: Optional[str],
        years_experience: Optional[int],
        target_company: Optional[str],
        target_role: Optional[str],
        job_description: Optional[str],
        interview_focus: Optional[str],
    ) -> ModeStartResult:
        jd_fit_context = await interview_service.build_jd_fit_context(
            target_company=target_company,
            target_role=target_role or "",
            job_description=job_description or "",
            interview_focus=interview_focus or "mixed",
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
