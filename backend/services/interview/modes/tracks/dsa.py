from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from models.interview import DifficultyLevel


LIVE_PAIR_TRACKS = frozenset({"dsa"})
PAIR_TRACKS_SOON = frozenset({"lld", "bugfix"})


def normalize_pair_track(track: Optional[str]) -> str:
    raw = (track or "dsa").strip().lower() or "dsa"
    return raw


def is_live_pair_track(track: Optional[str]) -> bool:
    return normalize_pair_track(track) in LIVE_PAIR_TRACKS


async def seed_dsa_coding_question(
    *,
    interview_service: Any,
    difficulty: DifficultyLevel,
    resume_data: Dict[str, Any],
    session_focus: Optional[str] = None,
    years_experience: Optional[int] = None,
) -> Dict[str, Any]:
    """Generate one DSA coding question blob for Pair Programming."""
    focus = (session_focus or "").strip()
    context_parts = [
        "Pair programming DSA track. Generate a coding interview problem.",
    ]
    if focus:
        context_parts.append(f"Session focus topics: {focus}")
    if years_experience is not None:
        context_parts.append(f"Years of experience: {years_experience}")
    if isinstance(resume_data, dict) and resume_data:
        context_parts.append("Candidate has a resume on file; keep problem general-purpose.")
    context = "\n".join(context_parts)
    question = await interview_service.generate_coding_question(
        track="dsa",
        difficulty=difficulty,
        context=context,
    )
    return {
        "question": question,
        "type": "coding",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
