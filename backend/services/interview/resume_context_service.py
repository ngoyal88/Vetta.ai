from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


def _clean_text(value: Any, limit: int = 280) -> str:
    if value is None:
        return ""
    text = " ".join(str(value).split()).strip()
    return text[:limit]


def _parse_date(value: Any) -> datetime:
    text = _clean_text(value, 40).replace("Present", "9999-12")
    if not text:
        return datetime.min
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(text[: len(fmt)], fmt)
        except Exception:
            continue
    return datetime.min


def _dedupe_keep_order(items: List[str], limit: int) -> List[str]:
    seen = set()
    out: List[str] = []
    for item in items:
        clean = _clean_text(item, 180)
        if not clean:
            continue
        key = clean.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(clean)
        if len(out) >= limit:
            break
    return out


def _build_role_target(role: Dict[str, Any], idx: int) -> Tuple[float, Dict[str, Any]]:
    title = _clean_text(role.get("title"), 80) or "Role"
    company = _clean_text(role.get("company"), 80) or "Company"
    end_at = role.get("end_date") or role.get("endDate") or role.get("to")
    start_at = role.get("start_date") or role.get("startDate") or role.get("from")
    responsibilities = role.get("responsibilities") or []
    impact = role.get("impact") or []
    detail = ""
    if isinstance(impact, list) and impact:
        detail = _clean_text(impact[0], 220)
    if not detail and isinstance(responsibilities, list) and responsibilities:
        detail = _clean_text(responsibilities[0], 220)
    if not detail:
        detail = "Walk through your scope, ownership, and measurable outcomes."
    end_key = _parse_date(end_at)
    seniority_tokens = ("lead", "senior", "principal", "staff", "manager")
    seniority_bonus = 0.15 if any(tok in title.lower() for tok in seniority_tokens) else 0.0
    evidence_count = (len(responsibilities) if isinstance(responsibilities, list) else 0) + (
        len(impact) if isinstance(impact, list) else 0
    )
    evidence_bonus = min(0.25, evidence_count * 0.03)
    score = float(end_key.toordinal()) + seniority_bonus + evidence_bonus - idx * 0.001
    label = f"{title} @ {company}"
    if start_at or end_at:
        label += f" ({_clean_text(start_at, 12) or '?'} - {_clean_text(end_at, 12) or 'Present'})"
    target = {
        "id": f"role_{idx + 1}",
        "kind": "role",
        "label": label,
        "detail": detail,
        "resume_ref": detail,
    }
    return score, target


def _build_project_target(project: Dict[str, Any], idx: int) -> Tuple[float, Dict[str, Any]]:
    name = _clean_text(project.get("name"), 90) or f"Project {idx + 1}"
    role = _clean_text(project.get("role"), 90)
    description = _clean_text(project.get("description"), 260)
    scale = _clean_text(project.get("scale"), 140)
    tech_stack = project.get("tech_stack") or project.get("techStack") or []
    tech_count = len(tech_stack) if isinstance(tech_stack, list) else 0
    detail = description or scale or "Explain architecture, tradeoffs, and delivery impact."
    score = (len(description) / 260.0) + min(0.3, tech_count * 0.05) + (0.2 if scale else 0.0) - idx * 0.001
    label = f"{name}" + (f" ({role})" if role else "")
    target = {
        "id": f"project_{idx + 1}",
        "kind": "project",
        "label": label,
        "detail": detail,
        "resume_ref": description or label,
    }
    return score, target


class ResumeContextService:
    def build_context(
        self,
        *,
        resume_data: Optional[Dict[str, Any]],
        years_experience: Optional[int] = None,
    ) -> Dict[str, Any]:
        profile = resume_data if isinstance(resume_data, dict) else {}
        work_experience = profile.get("work_experience") or []
        projects = profile.get("projects") or []
        achievements = profile.get("achievements") or []
        weak_areas = profile.get("weak_areas") or []

        ranked: List[Tuple[float, Dict[str, Any]]] = []

        if isinstance(work_experience, list):
            for idx, role in enumerate(work_experience):
                if isinstance(role, dict):
                    ranked.append(_build_role_target(role, idx))

        if isinstance(projects, list):
            for idx, project in enumerate(projects):
                if isinstance(project, dict):
                    ranked.append(_build_project_target(project, idx))

        if isinstance(achievements, list):
            for idx, achievement in enumerate(achievements[:3]):
                if not isinstance(achievement, dict):
                    continue
                title = _clean_text(achievement.get("title"), 90) or f"Achievement {idx + 1}"
                detail = _clean_text(achievement.get("description"), 220) or "Explain context and business impact."
                ranked.append(
                    (
                        0.7 - idx * 0.01,
                        {
                            "id": f"achievement_{idx + 1}",
                            "kind": "achievement",
                            "label": title,
                            "detail": detail,
                            "resume_ref": detail,
                        },
                    )
                )

        if isinstance(weak_areas, list):
            for idx, area in enumerate(weak_areas[:2]):
                clean = _clean_text(area, 120)
                if not clean:
                    continue
                ranked.append(
                    (
                        0.65 - idx * 0.01,
                        {
                            "id": f"weak_area_{idx + 1}",
                            "kind": "weak_area",
                            "label": f"Weak area: {clean}",
                            "detail": f"Probe depth and improvement plan around: {clean}.",
                            "resume_ref": clean,
                        },
                    )
                )

        ranked.sort(key=lambda item: item[0], reverse=True)
        probe_targets: List[Dict[str, Any]] = []
        seen = set()
        for _, target in ranked:
            key = f"{target.get('kind')}:{str(target.get('label')).lower()}"
            if key in seen:
                continue
            seen.add(key)
            probe_targets.append(target)
            if len(probe_targets) >= 5:
                break

        probing_areas = _dedupe_keep_order([t.get("label", "") for t in probe_targets], limit=5)
        interview_plan = _dedupe_keep_order(
            [f"Question {idx + 1}: {t.get('label')}" for idx, t in enumerate(probe_targets)],
            limit=6,
        )
        strengths = _dedupe_keep_order(
            [
                t.get("label", "")
                for t in probe_targets
                if t.get("kind") in {"role", "project", "achievement"}
            ],
            limit=4,
        )
        gaps = _dedupe_keep_order(
            [str(item) for item in weak_areas] + [t.get("label", "") for t in probe_targets if t.get("kind") == "weak_area"],
            limit=4,
        )

        candidate_name = _clean_text(profile.get("name"), 80) or "the candidate"
        years = years_experience
        if years is None:
            try:
                years_raw = profile.get("years_experience")
                years = int(years_raw) if years_raw is not None else None
            except Exception:
                years = None
        years_label = f"{years} years" if isinstance(years, int) else "their background"
        summary = (
            f"Resume deep-dive for {candidate_name}: focus on high-signal roles/projects and verify ownership, "
            f"tradeoffs, and measurable impact from {years_label} of experience."
        )

        return {
            "summary": summary,
            "probe_targets": probe_targets,
            "probing_areas": probing_areas,
            "interview_plan": interview_plan,
            "candidate_strengths": strengths,
            "candidate_gaps": gaps,
        }
