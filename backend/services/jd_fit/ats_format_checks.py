"""Deterministic ATS format warnings — no LLM on hot path."""

from __future__ import annotations

import re
from typing import Any, Dict, List


def compute_ats_format_warnings(profile: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []

    summary = profile.get("summary") or profile.get("headline") or ""
    if not isinstance(summary, str) or len(summary.strip()) < 40:
        warnings.append("Summary or headline is missing or very short")

    work = [exp for exp in (profile.get("work_experience") or []) if isinstance(exp, dict)]
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

    skills = profile.get("skills")
    has_skills = False
    if isinstance(skills, dict):
        has_skills = any(isinstance(v, list) and v for v in skills.values())
    elif isinstance(skills, list):
        has_skills = bool(skills)
    if not has_skills:
        warnings.append("Skills section appears empty")

    return warnings[:5]
