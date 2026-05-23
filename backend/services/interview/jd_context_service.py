import json
import re
from typing import Any, Dict, List, Optional

from services.interview.llm_engine import LLMEngine
from utils.logger import get_logger

logger = get_logger("JDContextService")

INTERVIEW_FOCUS_VALUES = {"mixed", "technical", "behavioral", "system_design", "dsa"}

# Only run JD-specific LLM extraction when the user supplied meaningful posting text.
MIN_JD_CHARS_FOR_LLM = 40


def clean_optional_text(value: Optional[str], max_len: int = 8000) -> Optional[str]:
    if value is None:
        return None
    cleaned = " ".join(str(value).split()).strip()
    if not cleaned:
        return None
    return cleaned[:max_len]


def extract_json_object(raw: str) -> Dict[str, Any]:
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


def _safe_list(value: Any, limit: int = 8) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip()[:180])
    return out[:limit]


def _merge_jd_context(parsed: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    """Keep LLM output but backfill empty list fields from deterministic fallback."""
    list_limits = {
        "required_skills": 8,
        "nice_to_have_skills": 8,
        "candidate_strengths": 8,
        "candidate_gaps": 8,
        "probing_areas": 8,
        "interview_plan": 6,
    }
    merged: Dict[str, Any] = {}
    for key, limit in list_limits.items():
        parsed_vals = _safe_list(parsed.get(key), limit=limit)
        fallback_vals = fallback.get(key) if isinstance(fallback.get(key), list) else []
        merged[key] = parsed_vals or fallback_vals
    summary = str(parsed.get("summary") or "").strip()[:600]
    merged["summary"] = summary or str(fallback.get("summary") or "").strip()[:600]
    return merged


def _resume_skills(resume_data: Optional[Dict[str, Any]]) -> List[str]:
    if not isinstance(resume_data, dict):
        return []
    raw_skills = resume_data.get("skills")
    skills: List[str] = []
    if isinstance(raw_skills, dict):
        for key in ("languages", "frameworks", "databases", "cloud", "tools", "ml_ai", "other"):
            skills.extend([s.strip() for s in raw_skills.get(key) or [] if isinstance(s, str) and s.strip()])
    elif isinstance(raw_skills, list):
        for item in raw_skills:
            if isinstance(item, str) and item.strip():
                skills.append(item.strip())
            elif isinstance(item, dict) and isinstance(item.get("name"), str):
                skills.append(item["name"].strip())
    return list(dict.fromkeys(skills))[:20]


def _role_probing_hints(target_role: str, interview_focus: str) -> List[str]:
    role_lower = (target_role or "").lower()
    hints: List[str] = []
    if any(k in role_lower for k in ("frontend", "react", "ui", "web")):
        hints.extend(["frontend architecture", "React/state", "performance and UX"])
    if any(k in role_lower for k in ("backend", "api", "platform", "full stack", "fullstack")):
        hints.extend(["API design", "data modeling", "reliability and scaling"])
    if any(k in role_lower for k in ("devops", "sre", "infra", "cloud", "platform")):
        hints.extend(["observability", "incident response", "infra tradeoffs"])
    if any(k in role_lower for k in ("data", "ml", "machine learning", "ai")):
        hints.extend(["data pipelines", "model lifecycle", "experimentation rigor"])
    if any(k in role_lower for k in ("mobile", "android", "ios")):
        hints.extend(["mobile performance", "offline/sync", "app architecture"])
    if any(k in role_lower for k in ("security", "sec ")):
        hints.extend(["threat modeling", "authn/z", "secure SDLC"])
    if any(k in role_lower for k in ("manager", "lead", "tpm", "product")):
        hints.extend(["stakeholder alignment", "prioritization", "delivery under ambiguity"])

    if not hints:
        focus_map = {
            "behavioral": ["ownership stories", "conflict resolution", "measurable impact"],
            "system_design": ["scalability", "consistency tradeoffs", "operational concerns"],
            "dsa": ["problem decomposition", "complexity", "correctness under edge cases"],
            "technical": ["implementation depth", "debugging", "production tradeoffs"],
            "mixed": ["technical depth", "behavioral signal", "system tradeoffs"],
        }
        hints = list(focus_map.get(interview_focus, focus_map["mixed"]))

    return list(dict.fromkeys(hints))[:6]


def _fallback_context(
    *,
    target_company: Optional[str],
    target_role: str,
    job_description: str,
    interview_focus: str,
    resume_data: Optional[Dict[str, Any]],
    years_experience: Optional[int],
) -> Dict[str, Any]:
    jd_text = (job_description or "").strip()
    jd_lower = jd_text.lower()
    role_hints = _role_probing_hints(target_role, interview_focus)
    skills = _resume_skills(resume_data)
    focus_label = interview_focus.replace("_", " ")

    if jd_text:
        common_terms = [
            "python", "java", "javascript", "typescript", "react", "node", "go", "sql",
            "postgres", "redis", "aws", "gcp", "azure", "kubernetes", "docker",
            "system design", "microservices", "api", "security", "machine learning",
        ]
        required = [term for term in common_terms if term in jd_lower][:8]
        strengths = [skill for skill in skills if skill.lower() in jd_lower][:5]
        gaps = [term for term in required if term.lower() not in {s.lower() for s in skills}][:5]
        probing = gaps or required[:4] or role_hints
        plan = [
            f"Start with a {focus_label} question for {target_role}.",
            "Probe resume evidence against the job description.",
            "Ask for specific tradeoffs, impact, and depth.",
        ]
    else:
        required = role_hints[:6]
        strengths = skills[:5]
        gaps = role_hints[3:6] if len(role_hints) > 3 else []
        probing = role_hints or [target_role]
        plan = [
            f"Open with a {focus_label} question calibrated to {target_role}.",
            "Use resume projects and skills as the primary evidence base.",
            "Ask for tradeoffs, impact, and depth typical of this role archetype.",
        ]

    company_bit = f" at {target_company}" if target_company else ""
    jd_bit = " Job posting provided." if jd_text else " No job posting; using role and resume context."
    return {
        "required_skills": required,
        "nice_to_have_skills": [],
        "candidate_strengths": strengths,
        "candidate_gaps": gaps,
        "probing_areas": probing,
        "interview_plan": plan,
        "summary": (
            f"Prepare the candidate for {target_role}{company_bit}. "
            f"Years of experience: {years_experience if years_experience is not None else 'unknown'}."
            f"{jd_bit}"
        ),
    }


class JDContextService:
    def __init__(self, engine: LLMEngine):
        self._engine = engine

    async def build_context(
        self,
        *,
        target_company: Optional[str],
        target_role: str,
        job_description: str,
        interview_focus: str,
        resume_data: Optional[Dict[str, Any]] = None,
        years_experience: Optional[int] = None,
    ) -> Dict[str, Any]:
        fallback = _fallback_context(
            target_company=target_company,
            target_role=target_role,
            job_description=job_description,
            interview_focus=interview_focus,
            resume_data=resume_data,
            years_experience=years_experience,
        )
        jd_text = (job_description or "").strip()
        if len(jd_text) < MIN_JD_CHARS_FOR_LLM:
            return fallback

        skills = _resume_skills(resume_data)
        prompt = f"""Return ONLY JSON for a role-targeted interview context.

Company: {target_company or ""}
Role: {target_role}
Focus: {interview_focus}
Years Experience: {years_experience if years_experience is not None else ""}
Candidate skills: {", ".join(skills)}
Job Description (optional posting text):
{jd_text[:8000]}

JSON schema:
{{
  "required_skills": [string],
  "nice_to_have_skills": [string],
  "candidate_strengths": [string],
  "candidate_gaps": [string],
  "probing_areas": [string],
  "interview_plan": [string],
  "summary": string
}}"""
        try:
            raw = await self._engine.generate_raw(prompt, 0.25, empty_fallback="{}")
            parsed = extract_json_object(raw)
            if not parsed:
                return fallback
            return _merge_jd_context(parsed, fallback)
        except Exception as exc:
            logger.warning("JD context generation failed; using fallback: %s", exc)
            return fallback
