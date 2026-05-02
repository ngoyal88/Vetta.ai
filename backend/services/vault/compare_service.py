import json
import re
from typing import Any, Dict, List, Optional

from services.integrations.groq_service import GroqService
from services.resume.scorecard_service import normalize_resume_for_scorecard, build_resume_scorecard


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


def _skill_set(profile: Dict[str, Any]) -> List[str]:
    normalized = normalize_resume_for_scorecard(profile)
    skills = normalized.get("skills") or []
    return list(dict.fromkeys([s for s in skills if isinstance(s, str) and s.strip()]))


def _compact_summary(profile: Dict[str, Any]) -> str:
    normalized = normalize_resume_for_scorecard(profile)
    skills = normalized.get("skills") or []
    projects = normalized.get("projects") or []
    work = normalized.get("work_experience") or []
    return (
        f"skills={len(skills)} projects={len(projects)} work_experiences={len(work)} "
        f"skills_sample={[s for s in skills[:10]]}"
    )


async def compare_profiles(
    profile_a: Dict[str, Any],
    profile_b: Dict[str, Any],
    role: Optional[str] = None,
) -> Dict[str, Any]:
    score_a = (await build_resume_scorecard(profile_data=profile_a, role_hint=role)).score
    score_b = (await build_resume_scorecard(profile_data=profile_b, role_hint=role)).score

    skills_a = set(_skill_set(profile_a))
    skills_b = set(_skill_set(profile_b))

    delta = score_a - score_b

    system_prompt = (
        "You compare two resumes for a role. Return ONLY JSON: "
        "{\"recommended_id\": \"a\"|\"b\", \"recommendation_reason\": string, "
        "\"section_verdicts\": object}"  # section_verdicts may be empty
        "."
    )
    user_prompt = (
        f"role={role or ''}\n"
        f"resume_a_summary={_compact_summary(profile_a)}\n"
        f"resume_b_summary={_compact_summary(profile_b)}\n"
        f"score_a={score_a} score_b={score_b}"
    )

    groq = GroqService()
    groq.model = "llama-3.3-70b-versatile"
    raw = await groq.chat([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])
    payload = _extract_json_obj(raw)

    recommended_id = payload.get("recommended_id")
    if recommended_id not in {"a", "b"}:
        recommended_id = "a" if score_a >= score_b else "b"

    reason = payload.get("recommendation_reason")
    if not isinstance(reason, str) or not reason.strip():
        reason = "Recommended based on overall score and skill coverage."

    section_verdicts = payload.get("section_verdicts")
    if not isinstance(section_verdicts, dict):
        section_verdicts = {}

    return {
        "score_a": score_a,
        "score_b": score_b,
        "score_delta": delta,
        "skills_only_in_a": sorted(list(skills_a - skills_b)),
        "skills_only_in_b": sorted(list(skills_b - skills_a)),
        "recommended_id": recommended_id,
        "recommendation_reason": reason,
        "section_verdicts": section_verdicts,
    }
