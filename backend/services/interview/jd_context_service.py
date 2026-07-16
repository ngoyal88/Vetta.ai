import json
import re
from typing import Any, Dict, List, Optional

from services.interview.llm_engine import LLMEngine
from services.interview.prompt_contracts import extract_json_dict
from services.jd_fit.jd_fit_weights import MIN_JD_CHARS
from services.resume.skills_normalizer import flatten_skills_from_profile
from utils.logger import get_logger

logger = get_logger("JDContextService")

INTERVIEW_FOCUS_VALUES = {"mixed", "technical", "behavioral", "system_design", "dsa"}

# Backward-compatible alias for interview callers.
MIN_JD_CHARS_FOR_LLM = MIN_JD_CHARS

# Match whole skill tokens only — substring "go" must not hit "good" / "growth".
_WORD_BOUNDARY_CACHE: dict[str, re.Pattern[str]] = {}


def _term_in_jd(term: str, jd_lower: str) -> bool:
    key = term.strip().lower()
    if not key:
        return False
    if " " in key:
        return key in jd_lower
    pattern = _WORD_BOUNDARY_CACHE.get(key)
    if pattern is None:
        pattern = re.compile(rf"(?<![a-z0-9]){re.escape(key)}(?![a-z0-9])", re.I)
        _WORD_BOUNDARY_CACHE[key] = pattern
    return bool(pattern.search(jd_lower))


def clean_optional_text(value: Optional[str], max_len: int = 8000) -> Optional[str]:
    if value is None:
        return None
    cleaned = " ".join(str(value).split()).strip()
    if not cleaned:
        return None
    return cleaned[:max_len]

def _safe_list(value: Any, limit: int = 8) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip()[:180])
    return out[:limit]


def _safe_typed_requirements(value: Any, fallback: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if isinstance(value, list):
        for idx, item in enumerate(value):
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or item.get("requirement") or "").strip()[:220]
            category = str(item.get("category") or "technical_skill").strip()
            if not text:
                continue
            alternatives = item.get("alternatives") if isinstance(item.get("alternatives"), list) else []
            satisfy_mode = str(item.get("satisfy_mode") or "all").strip()
            rows.append(
                {
                    "id": str(item.get("id") or f"req_{idx + 1}").strip()[:80],
                    "category": category,
                    "text": text,
                    "alternatives": alternatives,
                    "satisfy_mode": satisfy_mode,
                    "importance": str(item.get("importance") or "required").strip(),
                    "strictness": str(item.get("strictness") or "flexible").strip(),
                    "funnel_stage": str(item.get("funnel_stage") or "hm_review").strip(),
                    "weight": item.get("weight", 0.05),
                    "is_hard_gate": bool(item.get("is_hard_gate", False)),
                }
            )
    if rows:
        return rows

    from services.jd_fit.typed_requirement_alignment import fallback_typed_requirements

    return [req.model_dump() for req in fallback_typed_requirements(
        fallback.get("required_skills") or [],
        fallback.get("nice_to_have_skills") or [],
    )]


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
    merged["typed_requirements"] = _safe_typed_requirements(parsed.get("typed_requirements"), merged)
    return merged


_OR_REPAIR_SYSTEM = (
    "You repair JD typed_requirements so OR / one-of skill groups are correct. Return ONLY JSON: "
    "{\"typed_requirements\":[same schema as input rows]}.\n"
    "Rules:\n"
    "- When the JD asks for one of several options (e.g. \"Node.js, Python, Java, or similar\", "
    "\"React preferred; Angular or Vue\", \"AWS, GCP, or Azure\"), merge those into ONE row with "
    "satisfy_mode \"any\", text=primary/preferred option, alternatives=rest. Delete the standalone "
    "duplicate rows for those alternatives.\n"
    "- Do not invent requirements that are not in the JD or the input list.\n"
    "- Preferred Qualifications / bonus skills must have importance \"preferred\" or \"bonus\", never \"required\".\n"
    "- Experience years must match the JD band exactly (e.g. \"1-2 years\", not \"2+\" if JD says 1-2).\n"
    "- Preserve ids when merging: keep the primary row id; drop ids of collapsed alternatives.\n"
    "- Keep funnel_stage/category/weight sensible; keep hard gates unchanged."
)


async def _repair_or_groups(
    engine: LLMEngine,
    jd_text: str,
    typed_requirements: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Second-pass LLM repair so alternatives are not scored as independent must-haves."""
    if not typed_requirements or len(jd_text.strip()) < MIN_JD_CHARS:
        return typed_requirements
    tech_rows = [
        row
        for row in typed_requirements
        if isinstance(row, dict) and str(row.get("category") or "") == "technical_skill"
    ]
    if len(tech_rows) < 2:
        return typed_requirements

    payload = {
        "job_description": jd_text[:8000],
        "typed_requirements": typed_requirements,
    }
    try:
        raw = await engine.generate_raw(
            f"{_OR_REPAIR_SYSTEM}\n\nINPUT:\n{json.dumps(payload, ensure_ascii=True)}",
            0.1,
            empty_fallback="{}",
        )
        parsed = extract_json_dict(raw)
        repaired = parsed.get("typed_requirements") if isinstance(parsed, dict) else None
        if not isinstance(repaired, list) or not repaired:
            return typed_requirements
        cleaned = _safe_typed_requirements(repaired, {"required_skills": [], "nice_to_have_skills": []})
        return cleaned or typed_requirements
    except Exception as exc:
        logger.warning("OR-group repair failed; keeping original requirements: %s", exc)
        return typed_requirements


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
    skills = flatten_skills_from_profile(resume_data)[:20]
    focus_label = interview_focus.replace("_", " ")

    if jd_text:
        common_terms = [
            "python", "java", "javascript", "typescript", "react", "node", "go", "sql",
            "postgres", "redis", "aws", "gcp", "azure", "kubernetes", "docker",
            "system design", "microservices", "api", "security", "machine learning",
        ]
        required = [term for term in common_terms if _term_in_jd(term, jd_lower)][:8]
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
    from services.jd_fit.typed_requirement_alignment import (
        ensure_experience_requirements,
        normalize_typed_requirements,
    )

    typed_requirements = ensure_experience_requirements(
        normalize_typed_requirements(
            _safe_typed_requirements([], {"required_skills": required, "nice_to_have_skills": []}),
        ),
        jd_text,
        target_role,
    )
    return {
        "required_skills": required,
        "nice_to_have_skills": [],
        "typed_requirements": [req.model_dump() for req in typed_requirements],
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
        if len(jd_text) < MIN_JD_CHARS:
            return fallback

        skills = flatten_skills_from_profile(resume_data)[:20]
        prompt = f"""Return ONLY JSON for a role-targeted interview context and application-fit analysis.

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
  "typed_requirements": [
    {{
      "id": string,
      "category": "technical_skill" | "experience" | "education" | "certification" | "domain" | "seniority" | "location" | "work_authorization" | "language" | "management" | "travel" | "employment_type" | "soft_skill",
      "text": string,
      "alternatives": [string],
      "satisfy_mode": "all" | "any",
      "importance": "required" | "preferred" | "bonus",
      "strictness": "hard" | "flexible",
      "funnel_stage": "ats_filter" | "recruiter_screen" | "hm_review",
      "weight": number,
      "is_hard_gate": boolean
    }}
  ],
  "candidate_strengths": [string],
  "candidate_gaps": [string],
  "probing_areas": [string],
  "interview_plan": [string],
  "summary": string
}}

Requirement extraction rules:
- Extract all meaningful JD requirements, not only skills.
- Mark work authorization, security clearance, mandatory location/onsite, required licenses, required language fluency, and strict required certifications as hard gates.
- Use "unknown" only later during alignment; extraction should describe the JD requirement itself.
- Keep weights modest, usually 0.03 to 0.12, with required requirements above preferred requirements.
- OR / one-of groups: when the JD asks for proficiency in ONE OF several options — including phrasing like
  "Node.js, Python, Java, or similar", "one of C++/Python/Java", "React preferred; Angular or Vue considered",
  "AWS, GCP, or Azure" — emit ONE typed_requirements row with satisfy_mode "any", text = the primary/preferred
  option, alternatives = the remaining options. Do NOT emit separate required rows for each alternative.
  Also do NOT list each alternative as its own entry in required_skills.
- AND requirements: when the JD requires multiple distinct skills (e.g. "Python and SQL"), emit separate rows with satisfy_mode "all" (default).
- Preferred / bonus: experience shipping React Native, GraphQL, Docker/cloud, Next.js, LLM APIs, etc. listed under
  Preferred Qualifications → importance "preferred" or "bonus", never "required".
- Experience years: emit one short experience row (e.g. "1–2 years professional software engineering experience")
  with funnel_stage "recruiter_screen", not the full JD paragraph.
- required_skills must mirror typed technical requirements without duplicating OR alternatives.

Examples:
JD: "Proficiency in one of C++, Python, or Java"
→ {{ "text": "Python", "alternatives": ["C++", "Java"], "satisfy_mode": "any", "importance": "required", "category": "technical_skill", "funnel_stage": "ats_filter" }}

JD: "Solid server-side programming experience (Node.js, Python, Java, or similar)"
→ {{ "text": "Node.js", "alternatives": ["Python", "Java"], "satisfy_mode": "any", "importance": "required", "category": "technical_skill", "funnel_stage": "ats_filter" }}

JD: "Proficiency with at least one modern frontend framework (React preferred; Angular or Vue considered)"
→ {{ "text": "React", "alternatives": ["Angular", "Vue"], "satisfy_mode": "any", "importance": "required", "category": "technical_skill", "funnel_stage": "ats_filter" }}

JD: "Strong Python and SQL experience required"
→ two rows: {{ "text": "Python", "satisfy_mode": "all" }} and {{ "text": "SQL", "satisfy_mode": "all" }}"""
        try:
            raw = await self._engine.generate_raw(prompt, 0.25, empty_fallback="{}")
            parsed = extract_json_dict(raw)
            if not parsed:
                return fallback
            merged = _merge_jd_context(parsed, fallback)
            merged["typed_requirements"] = await _repair_or_groups(
                self._engine,
                jd_text,
                merged.get("typed_requirements") or [],
            )
            return merged
        except Exception as exc:
            logger.warning("JD context generation failed; using fallback: %s", exc)
            return fallback
