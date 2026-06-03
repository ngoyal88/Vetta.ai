import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from models.vault import VaultScorecard
from services.llm.platform_llm import get_platform_llm
from services.resume.scorecard_service import build_resume_scorecard


def _extract_json_obj(raw: str) -> Dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}


def _safe_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def _compact_resume_text(profile: Dict[str, Any]) -> str:
    parts: List[str] = []
    name = profile.get("name")
    if isinstance(name, str) and name.strip():
        parts.append(f"Name: {name.strip()}")
    summary = profile.get("summary")
    if isinstance(summary, str) and summary.strip():
        parts.append(f"Summary: {summary.strip()}")

    skills = profile.get("skills")
    skill_list: List[str] = []
    if isinstance(skills, dict):
        for key in ("languages", "frameworks", "databases", "cloud", "tools", "ml_ai", "other"):
            skill_list.extend([s for s in skills.get(key) or [] if isinstance(s, str)])
    elif isinstance(skills, list):
        for item in skills:
            if isinstance(item, dict) and isinstance(item.get("name"), str):
                skill_list.append(item.get("name"))
            elif isinstance(item, str):
                skill_list.append(item)
    if skill_list:
        parts.append("Skills: " + ", ".join(skill_list[:40]))

    experience = profile.get("work_experience") or profile.get("workExperience") or []
    if isinstance(experience, list) and experience:
        titles = []
        for item in experience:
            if not isinstance(item, dict):
                continue
            title = item.get("title") or item.get("jobTitle")
            company = item.get("company") or item.get("organization")
            if title or company:
                titles.append(" / ".join([t for t in [title, company] if t]))
        if titles:
            parts.append("Experience: " + "; ".join(titles[:6]))

    projects = profile.get("projects") or []
    if isinstance(projects, list) and projects:
        proj_names = []
        for item in projects:
            if isinstance(item, dict):
                name = item.get("name")
                if isinstance(name, str) and name.strip():
                    proj_names.append(name.strip())
            elif isinstance(item, str) and item.strip():
                proj_names.append(item.strip())
        if proj_names:
            parts.append("Projects: " + ", ".join(proj_names[:6]))

    raw_text = profile.get("raw_text")
    if isinstance(raw_text, str) and raw_text.strip():
        parts.append("Raw: " + raw_text.strip()[:1500])

    return "\n".join(parts)[:3000]


async def extract_ats_flags(profile: Dict[str, Any]) -> List[str]:
    system_prompt = (
        "You detect ATS red flags in resumes. Return ONLY JSON: {\"flags\": [string, ...]}."
    )
    user_prompt = "Resume data:\n" + _compact_resume_text(profile)
    raw = await get_platform_llm().json_completion(system_prompt, user_prompt)
    payload = _extract_json_obj(raw)
    return _safe_list(payload.get("flags"))


async def extract_role_fit(role: Optional[str], profile: Dict[str, Any]) -> Tuple[Optional[int], Optional[str]]:
    if not role:
        return None, None

    system_prompt = (
        "You score role fit for a resume. Return ONLY JSON: {\"role_fit_score\": int, \"fit_reason\": string}."
    )
    user_prompt = f"role={role}\nresume=\n{_compact_resume_text(profile)}"
    raw = await get_platform_llm().json_completion(system_prompt, user_prompt)
    payload = _extract_json_obj(raw)
    score = payload.get("role_fit_score")
    if isinstance(score, (int, float)):
        score_value = max(0, min(100, int(round(score))))
    else:
        score_value = None
    return score_value, role


async def generate_diff_summary(prev_profile: Dict[str, Any], next_profile: Dict[str, Any]) -> Optional[str]:
    system_prompt = (
        "Summarize differences between two resume versions. Return ONLY JSON: {\"diff_summary\": string}."
    )
    user_prompt = (
        "PREVIOUS:\n" + _compact_resume_text(prev_profile) + "\n\n" +
        "CURRENT:\n" + _compact_resume_text(next_profile)
    )
    raw = await get_platform_llm().json_completion(system_prompt, user_prompt)
    payload = _extract_json_obj(raw)
    summary = payload.get("diff_summary")
    if isinstance(summary, str) and summary.strip():
        return summary.strip()

    return "Updated resume content and adjusted skills or experience entries."


async def build_vault_scorecard(profile: Dict[str, Any], role: Optional[str] = None) -> VaultScorecard:
    base = await build_resume_scorecard(profile_data=profile, role_hint=role)
    ats_flags = await extract_ats_flags(profile)
    role_fit_score, role_fit_role = await extract_role_fit(role, profile)

    weak_areas = []
    raw_weak = profile.get("weak_areas")
    if isinstance(raw_weak, list):
        weak_areas = [w for w in raw_weak if isinstance(w, str) and w.strip()]

    return VaultScorecard(
        score=base.score,
        coverage_counts=base.coverage_counts.model_dump(),
        summary_line=base.summary_line,
        role_fit_score=role_fit_score,
        role_fit_role=role_fit_role,
        ats_flags=ats_flags,
        weak_areas=weak_areas,
        suggestions=base.suggestions,
        last_analyzed_at=datetime.now(timezone.utc),
    )
