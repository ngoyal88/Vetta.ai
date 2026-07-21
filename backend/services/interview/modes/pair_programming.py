from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException
from models.interview import InterviewType
from services.interview.modes.base import InterviewModeStrategy, ModeStartResult
from services.interview.modes.start_configs import ModeStartConfig, PairProgrammingStartConfig
from services.interview.modes.tracks.dsa import (
    is_live_pair_track,
    normalize_pair_track,
    seed_dsa_coding_question,
)


class PairProgrammingModeStrategy(InterviewModeStrategy):
    mode = InterviewType.PAIR_PROGRAMMING

    async def prepare_start(
        self,
        *,
        interview_service: Any,
        difficulty,
        resume_data: Dict[str, Any],
        years_experience: Optional[int],
        config: ModeStartConfig,
    ) -> ModeStartResult:
        if not isinstance(config, PairProgrammingStartConfig):
            raise TypeError("PairProgrammingModeStrategy requires PairProgrammingStartConfig")

        track_id = normalize_pair_track(config.track)
        if not is_live_pair_track(track_id):
            raise HTTPException(
                400,
                f"Pair Programming track '{track_id}' is not available yet. Use track 'dsa'.",
            )

        focus = (config.session_focus or "").strip() or None
        seeded = await seed_dsa_coding_question(
            interview_service=interview_service,
            difficulty=difficulty,
            resume_data=resume_data or {},
            session_focus=focus,
            years_experience=years_experience,
        )
        target_context = {
            "track": track_id,
            "session_focus": focus,
        }
        return ModeStartResult(
            target_context=target_context,
            jd_fit_context={},
            resume_probe_context={},
            seeded_questions=[seeded],
        )
