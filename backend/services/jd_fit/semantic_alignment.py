"""Strict LLM semantic alignment of JD requirements to resume evidence."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from config import get_settings
from services.interview.llm_engine import get_platform_llm
from services.interview.prompt_contracts import extract_json_dict
from services.jd_fit.funnel_scoring import build_keyword_alignment_fallback
from services.jd_fit.jd_fit_models import (
    RequirementAlignment,
    RoleRelevanceSignals,
    SemanticAlignmentResult,
)
from utils.logger import get_logger

logger = get_logger(__name__)

MAX_REQUIREMENTS_IN_PROMPT = 15
VALID_MATCH_STATUSES = frozenset({"strong", "partial", "missing", "unclear"})
VALID_ROLE_LEVELS = frozenset({"strong", "partial", "weak"})


def _safe_str_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if isinstance(item, str) and item.strip()]


def _normalize_role_relevance(raw: Any) -> RoleRelevanceSignals:
    if not isinstance(raw, dict):
        return RoleRelevanceSignals()
    title = str(raw.get("title_alignment") or "partial").lower()
    domain = str(raw.get("domain_alignment") or "partial").lower()
    if title not in VALID_ROLE_LEVELS:
        title = "partial"
    if domain not in VALID_ROLE_LEVELS:
        domain = "partial"
    return RoleRelevanceSignals(
        title_alignment=title,  # type: ignore[arg-type]
        domain_alignment=domain,  # type: ignore[arg-type]
    )


def _evidence_in_corpus(evidence: Optional[str], compact_resume: str) -> bool:
    if not evidence or not compact_resume:
        return False
    ev = evidence.strip().lower()
    if len(ev) < 8:
        return ev in compact_resume.lower()
    # Require substantial overlap — first 40 chars of normalized evidence
    needle = ev[: min(80, len(ev))]
    return needle in compact_resume.lower()


def _parse_requirement_row(
    raw: Dict[str, Any],
    compact_resume: str,
) -> Optional[RequirementAlignment]:
    requirement = str(raw.get("jd_requirement") or raw.get("requirement") or "").strip()
    if not requirement:
        return None

    status = str(raw.get("match_status") or "unclear").lower()
    if status not in VALID_MATCH_STATUSES:
        status = "unclear"

    evidence = raw.get("resume_evidence")
    evidence_str = str(evidence).strip() if isinstance(evidence, str) and evidence.strip() else None

    if status in ("strong", "partial"):
        if not evidence_str or not _evidence_in_corpus(evidence_str, compact_resume):
            status = "unclear"
            evidence_str = None

    confidence_raw = raw.get("confidence")
    confidence = 0.5
    if isinstance(confidence_raw, (int, float)):
        confidence = max(0.0, min(1.0, float(confidence_raw)))

    return RequirementAlignment(
        jd_requirement=requirement,
        match_status=status,  # type: ignore[arg-type]
        confidence=confidence,
        resume_evidence=evidence_str,
        equivalent_terms_found=_safe_str_list(raw.get("equivalent_terms_found")),
    )


def _parse_llm_payload(
    payload: Dict[str, Any],
    compact_resume: str,
) -> SemanticAlignmentResult:
    rows: List[RequirementAlignment] = []
    for item in payload.get("requirements") or []:
        if not isinstance(item, dict):
            continue
        parsed = _parse_requirement_row(item, compact_resume)
        if parsed:
            rows.append(parsed)

    return SemanticAlignmentResult(
        requirements=rows,
        role_relevance=_normalize_role_relevance(payload.get("role_relevance")),
        alignment_mode="llm",
    )


def _build_system_prompt() -> str:
    return (
        "You align job requirements to resume evidence for application fit analysis. "
        "Return ONLY JSON with this exact shape:\n"
        "{\n"
        '  "requirements": [\n'
        "    {\n"
        '      "jd_requirement": string,\n'
        '      "match_status": "strong" | "partial" | "missing" | "unclear",\n'
        '      "confidence": number,\n'
        '      "resume_evidence": string | null,\n'
        '      "equivalent_terms_found": [string]\n'
        "    }\n"
        "  ],\n"
        '  "role_relevance": {\n'
        '    "title_alignment": "strong" | "partial" | "weak",\n'
        '    "domain_alignment": "strong" | "partial" | "weak"\n'
        "  }\n"
        "}\n"
        "Rules:\n"
        "- Evaluate EACH requirement in the provided list as one row.\n"
        "- strong/partial MUST include a verbatim resume_evidence quote copied from the resume text.\n"
        "- Treat semantic equivalents (Kafka=event streaming, K8s=EKS/GKE, Redis=caching).\n"
        "- missing only when no reasonable equivalent exists in the resume.\n"
        "- partial when related experience exists but is indirect or shallow.\n"
        "- Do NOT output any fit score, bottleneck, or hiring recommendation."
    )


def _build_user_prompt(
    *,
    target_role: str,
    target_company: Optional[str],
    job_description: str,
    compact_resume: str,
    cig_summary: str,
    required_skills: List[str],
    nice_to_have_skills: List[str],
) -> str:
    reqs = required_skills[:MAX_REQUIREMENTS_IN_PROMPT]
    nice = nice_to_have_skills[:6]
    company_bit = f"Company: {target_company}\n" if target_company else ""
    return (
        f"Target role: {target_role}\n"
        f"{company_bit}"
        f"Required skills/requirements to evaluate:\n"
        + "\n".join(f"- {r}" for r in reqs)
        + "\n"
        f"Nice-to-have (evaluate only if listed above is short):\n"
        + ("\n".join(f"- {n}" for n in nice) if nice else "- none")
        + "\n\n"
        f"Candidate summary:\n{cig_summary}\n\n"
        f"Resume text:\n{compact_resume}\n\n"
        f"Job description:\n{job_description[:8000]}"
    )


async def run_semantic_alignment(
    *,
    target_role: str,
    target_company: Optional[str],
    job_description: str,
    compact_resume: str,
    cig_summary: str,
    required_skills: List[str],
    nice_to_have_skills: List[str],
    resume_corpus: str,
) -> SemanticAlignmentResult:
    """Run strict LLM alignment or keyword fallback when disabled/unavailable."""
    settings = get_settings()
    skills = [s for s in required_skills if s.strip()]
    if not skills:
        skills = nice_to_have_skills[:MAX_REQUIREMENTS_IN_PROMPT]

    if not skills:
        return SemanticAlignmentResult(alignment_mode="fallback")

    if not settings.jd_fit_semantic_alignment_enabled:
        return build_keyword_alignment_fallback(resume_corpus, skills, nice_to_have_skills)

    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(
        target_role=target_role,
        target_company=target_company,
        job_description=job_description,
        compact_resume=compact_resume,
        cig_summary=cig_summary,
        required_skills=skills,
        nice_to_have_skills=nice_to_have_skills,
    )

    try:
        raw = await get_platform_llm().json_completion(
            system_prompt,
            user_prompt,
        )
        payload = extract_json_dict(raw)
        if not payload:
            logger.warning("Semantic alignment returned unparseable JSON; using keyword fallback")
            return build_keyword_alignment_fallback(resume_corpus, skills, nice_to_have_skills)

        result = _parse_llm_payload(payload, compact_resume)
        if not result.requirements:
            logger.warning("Semantic alignment produced zero valid rows; using keyword fallback")
            return build_keyword_alignment_fallback(resume_corpus, skills, nice_to_have_skills)

        return result
    except Exception as exc:
        logger.warning("Semantic alignment failed; using keyword fallback: %s", exc, exc_info=True)
        return build_keyword_alignment_fallback(resume_corpus, skills, nice_to_have_skills)


def derive_skill_lists_from_alignment(
    alignment: SemanticAlignmentResult,
) -> tuple[List[str], List[str]]:
    matched: List[str] = []
    missing: List[str] = []
    for row in alignment.requirements:
        if row.match_status in ("strong", "partial"):
            matched.append(row.jd_requirement)
        elif row.match_status == "missing":
            missing.append(row.jd_requirement)
    return matched[:12], missing[:12]
