"""Deterministic ATS format warnings — no LLM on hot path."""

from __future__ import annotations

import re
from typing import Any, Dict, List

from services.resume.profile_normalizer import profile_snapshot_dict
from services.resume.skills_normalizer import flatten_skills_from_profile


def compute_ats_format_warnings(profile: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    canonical = profile_snapshot_dict(profile) if isinstance(profile, dict) else {}

    summary = canonical.get("summary") or canonical.get("headline") or ""
    if not isinstance(summary, str) or len(summary.strip()) < 40:
        warnings.append("Summary or headline is missing or very short")

    work = [exp for exp in (canonical.get("work_experience") or []) if isinstance(exp, dict)]
    if not work:
        warnings.append("No work experience section detected")
        return warnings[:5]

    recent = work[0]
    bullets = (recent.get("responsibilities") or []) + (recent.get("impact") or [])
    quantified = any(isinstance(b, str) and re.search(r"\d", b) for b in bullets)
    if not quantified:
        warnings.append("No quantified metrics in most recent role")

    if not recent.get("start_date"):
        warnings.append("Most recent role missing start date")

    has_skills = bool(flatten_skills_from_profile(canonical))
    if not has_skills:
        warnings.append("Skills section appears empty")

    return warnings[:5]
