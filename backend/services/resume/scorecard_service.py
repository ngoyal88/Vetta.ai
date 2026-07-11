import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from models.resume import ResumeCoverageCounts, ResumeScorecardMeta, ResumeScorecardResponse
from services.interview.llm_engine import get_platform_llm
from services.interview.prompt_contracts import extract_json_dict
from services.resume.skills_normalizer import flatten_skills_from_profile
from utils.logger import get_logger

logger = get_logger(__name__)

SCORECARD_VERSION = "resume_scorecard_v1"
SCORECARD_MODEL = "groq/llama-3.1-8b-instant"


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_str_list(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    out: List[str] = []
    for val in values:
        text = _safe_str(val)
        if text:
            out.append(text)
    return out


def _normalize_projects(profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    projects = profile.get("projects")
    if not isinstance(projects, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for item in projects:
        if not isinstance(item, dict):
            continue
        name = _safe_str(item.get("name"))
        description = _safe_str(item.get("description"))
        tech_stack = _safe_str_list(item.get("tech_stack") or item.get("technologies"))
        if not (name or description or tech_stack):
            continue
        normalized.append(
            {
                "name": name,
                "description": description,
                "tech_stack": tech_stack,
            }
        )
    return normalized


def _normalize_work_experience(profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    entries = profile.get("work_experience")
    if not isinstance(entries, list):
        entries = profile.get("workExperience")
    if not isinstance(entries, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for item in entries:
        if not isinstance(item, dict):
            continue
        title = _safe_str(item.get("title") or item.get("jobTitle"))
        company = _safe_str(item.get("company") or item.get("organization"))
        responsibilities = _safe_str_list(item.get("responsibilities"))
        description = _safe_str(item.get("jobDescription"))
        if description and not responsibilities:
            responsibilities = [description]
        if not (title or company or responsibilities):
            continue
        normalized.append(
            {
                "title": title,
                "company": company,
                "responsibilities": responsibilities,
            }
        )
    return normalized


def normalize_resume_for_scorecard(profile: Dict[str, Any]) -> Dict[str, Any]:
    normalized = {
        "skills": flatten_skills_from_profile(profile),
        "projects": _normalize_projects(profile),
        "work_experience": _normalize_work_experience(profile),
    }
    return normalized


def extract_coverage_counts(normalized: Dict[str, Any]) -> ResumeCoverageCounts:
    return ResumeCoverageCounts(
        skills=len(normalized.get("skills") or []),
        projects=len(normalized.get("projects") or []),
        work_experiences=len(normalized.get("work_experience") or []),
    )


def _fallback_score(counts: ResumeCoverageCounts) -> int:
    # Deterministic baseline score for resilience when LLM output is missing/invalid.
    skill_score = min(counts.skills, 12) / 12 * 45
    project_score = min(counts.projects, 3) / 3 * 30
    exp_score = min(counts.work_experiences, 2) / 2 * 25
    return int(round(skill_score + project_score + exp_score))


def build_rule_suggestions(counts: ResumeCoverageCounts) -> List[str]:
    suggestions: List[str] = []
    if counts.projects < 2:
        suggestions.append(
            "Add at least one more project with clear problem statement, tech stack, and measurable outcome."
        )
    if counts.work_experiences < 1:
        suggestions.append(
            "Include internship, freelance, or contract experience with concrete impact metrics."
        )
    if counts.skills < 6:
        suggestions.append(
            "Expand technical skills with role-relevant tools and group them by topic."
        )
    if not suggestions:
        suggestions.append("Keep project and experience sections updated with recent, quantified achievements.")
    return suggestions[:3]


def build_summary_line(counts: ResumeCoverageCounts) -> str:
    coverage = "good"
    if counts.projects < 2 or counts.work_experiences < 1 or counts.skills < 6:
        coverage = "fair"
    if counts.projects == 0 and counts.work_experiences == 0:
        coverage = "limited"
    return (
        f"Your resume mentions {counts.skills} skills, {counts.projects} projects, "
        f"{counts.work_experiences} work experiences - {coverage} coverage for interviews."
    )

async def _llm_score(
    normalized: Dict[str, Any], counts: ResumeCoverageCounts, role_hint: Optional[str]
) -> Dict[str, Any]:
    system_prompt = (
        "You evaluate resume readiness for interviews.\n"
        "Return only JSON with keys: score (0-100 integer), role_hint_text (string or null).\n"
        "Do not include personal data. Keep role_hint_text generic and concise."
    )
    user_prompt = (
        f"coverage_counts={counts.model_dump()}\n"
        f"projects_sample={[p.get('name') for p in (normalized.get('projects') or [])[:3]]}\n"
        f"has_responsibilities={any((w.get('responsibilities') for w in (normalized.get('work_experience') or [])))}\n"
        f"role_hint={role_hint or ''}\n"
    )
    raw = await get_platform_llm().json_completion(system_prompt, user_prompt)
    data = extract_json_dict(raw)
    score = data.get("score")
    role_hint_text = data.get("role_hint_text")
    parsed: Dict[str, Any] = {}
    if isinstance(score, (int, float)):
        parsed["score"] = max(0, min(100, int(round(score))))
    if isinstance(role_hint_text, str):
        value = role_hint_text.strip()
        parsed["role_hint_text"] = value if value else None
    return parsed


async def _llm_polish_suggestions(
    base_suggestions: List[str], counts: ResumeCoverageCounts, role_hint: Optional[str]
) -> List[str]:
    if not base_suggestions:
        return []

    system_prompt = (
        "Rewrite resume improvement suggestions for clarity.\n"
        "Return only JSON: {\"suggestions\": [string,...]}.\n"
        "Constraints: keep same number of suggestions, max 18 words each, no PII, no new claims."
    )
    user_prompt = (
        f"counts={counts.model_dump()}\n"
        f"role_hint={role_hint or ''}\n"
        f"suggestions={json.dumps(base_suggestions)}"
    )
    raw = await get_platform_llm().json_completion(system_prompt, user_prompt)
    payload = extract_json_dict(raw)
    items = payload.get("suggestions")
    if not isinstance(items, list):
        return base_suggestions

    polished: List[str] = []
    for item in items[: len(base_suggestions)]:
        text = _safe_str(item)
        if text:
            polished.append(text)
    if len(polished) != len(base_suggestions):
        return base_suggestions
    return polished[:3]


async def build_resume_scorecard(
    profile_data: Dict[str, Any], role_hint: Optional[str] = None
) -> ResumeScorecardResponse:
    started = time.perf_counter()

    normalized = normalize_resume_for_scorecard(profile_data or {})
    counts = extract_coverage_counts(normalized)
    base_suggestions = build_rule_suggestions(counts)
    fallback_used = False

    llm_payload = await _llm_score(normalized, counts, role_hint)
    if "score" in llm_payload:
        score = llm_payload["score"]
    else:
        score = _fallback_score(counts)
        fallback_used = True

    role_hint_text = llm_payload.get("role_hint_text")
    if role_hint and not role_hint_text:
        role_hint_text = f"Focus on {role_hint.lower()} evidence in projects and responsibilities."

    suggestions = await _llm_polish_suggestions(base_suggestions, counts, role_hint)
    if suggestions == base_suggestions and not llm_payload:
        fallback_used = True

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    if fallback_used:
        logger.warning(
            "resume_scorecard_fallback_used uid_scope=private latency_ms=%s",
            elapsed_ms,
        )
    logger.info(
        "resume_scorecard_generated uid_scope=private score=%s latency_ms=%s fallback_used=%s",
        score,
        elapsed_ms,
        fallback_used,
    )

    return ResumeScorecardResponse(
        score=score,
        coverage_counts=counts,
        summary_line=build_summary_line(counts),
        role_hint_text=role_hint_text,
        suggestions=suggestions[:3],
        meta=ResumeScorecardMeta(
            model=SCORECARD_MODEL,
            version=SCORECARD_VERSION,
            generated_at=datetime.now(timezone.utc).isoformat(),
            fallback_used=fallback_used,
        ),
    )
