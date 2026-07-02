"""Compact resume text for JD Fit semantic alignment prompts."""

from __future__ import annotations

from typing import Any, Dict, List

from services.jd_fit.candidate_graph import CandidateIntelligenceGraph
from services.jd_fit.resume_skills import flatten_resume_skills

MAX_COMPACT_CHARS = 4000


def _education_line(profile: Dict[str, Any]) -> str:
    education = profile.get("education") or []
    if not isinstance(education, list) or not education:
        return ""
    parts: List[str] = []
    for item in education[:2]:
        if not isinstance(item, dict):
            continue
        bits = [
            item.get("school") or item.get("institution"),
            item.get("degree"),
            item.get("field_of_study") or item.get("major"),
        ]
        line = ", ".join(str(b).strip() for b in bits if b)
        cgpa = item.get("cgpa") or item.get("gpa")
        if cgpa:
            line = f"{line} (CGPA: {cgpa})" if line else f"CGPA: {cgpa}"
        if line:
            parts.append(line)
    return "; ".join(parts)


def compact_resume_for_alignment(profile: Dict[str, Any]) -> str:
    """Build JD-Fit-specific compact resume with bullets for semantic alignment."""
    parts: List[str] = []

    summary = profile.get("summary") or profile.get("headline")
    if isinstance(summary, str) and summary.strip():
        parts.append(f"Summary: {summary.strip()}")

    skills = flatten_resume_skills(profile)
    if skills:
        parts.append("Skills: " + ", ".join(skills[:40]))

    work = profile.get("work_experience") or profile.get("workExperience") or []
    if isinstance(work, list):
        for exp in work[:3]:
            if not isinstance(exp, dict):
                continue
            title = exp.get("title") or exp.get("jobTitle") or ""
            company = exp.get("company") or exp.get("organization") or ""
            start = exp.get("start_date") or ""
            end = exp.get("end_date") or "Present"
            employment_type = exp.get("employment_type") or ""
            header = " / ".join(str(x).strip() for x in (title, company) if x)
            if employment_type:
                header = f"{header} [{employment_type}]".strip()
            if start or end:
                header = f"{header} ({start} - {end})".strip()
            if header:
                parts.append(f"\nRole: {header}")
            bullets: List[str] = []
            for bullet in (exp.get("responsibilities") or []) + (exp.get("impact") or []):
                if isinstance(bullet, str) and bullet.strip():
                    bullets.append(bullet.strip())
            for bullet in bullets[:3]:
                parts.append(f"  - {bullet}")

    projects = profile.get("projects") or []
    if isinstance(projects, list) and projects:
        proj_lines: List[str] = []
        for proj in projects[:4]:
            if not isinstance(proj, dict):
                continue
            name = proj.get("name") or proj.get("title")
            desc = proj.get("description") or proj.get("summary")
            if name:
                line = str(name).strip()
                if isinstance(desc, str) and desc.strip():
                    line = f"{line}: {desc.strip()[:120]}"
                proj_lines.append(line)
        if proj_lines:
            parts.append("Projects: " + "; ".join(proj_lines))

    edu = _education_line(profile)
    if edu:
        parts.append(f"Education: {edu}")

    text = "\n".join(parts).strip()
    return text[:MAX_COMPACT_CHARS]


def build_cig_summary(cig: CandidateIntelligenceGraph) -> str:
    """Short structured summary so the LLM does not re-parse resume structure."""
    top_skills = list(cig.skills_resume.keys())[:12]
    lines = [
        f"Seniority: {cig.seniority_level}",
        f"Years experience: {cig.years_experience if cig.years_experience is not None else 'unknown'}",
        f"Tenure gaps over 6mo: {'yes' if cig.has_tenure_gaps else 'no'}",
        f"Quantified bullets in recent roles: {'yes' if cig.has_quantified_bullets else 'no'}",
        f"Recent title tokens: {', '.join(cig.title_tokens[:8]) or 'none'}",
        f"Top resume skill keys: {', '.join(top_skills) or 'none'}",
        f"VPM accepted skills: {', '.join(list(cig.skills_vpm.keys())[:8]) or 'none'}",
    ]
    return "\n".join(lines)
