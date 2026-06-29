"""Funnel layer scoring — semantic alignment primary, keyword fallback."""

from __future__ import annotations

import re
from typing import List, Optional

from services.jd_fit.candidate_graph import CandidateIntelligenceGraph
from services.jd_fit.jd_fit_models import (
    ATSLayerResult,
    BottleneckStage,
    HMLayerResult,
    LayerVerdict,
    RecruiterLayerResult,
    RequirementAlignment,
    RoleRelevanceSignals,
    SemanticAlignmentResult,
)
from services.jd_fit.jd_fit_weights import (
    DEPTH_WEIGHTS,
    MATCH_STATUS_WEIGHTS,
    RECRUITER_QUANTIFIED_WEIGHT,
    RECRUITER_TENURE_WEIGHT,
    RECRUITER_TITLE_SENIORITY_WEIGHT,
    RECRUITER_TITLE_TOKEN_WEIGHT,
    ROLE_ALIGNMENT_SCORES,
    ROLE_RELEVANCE_BLEND_WEIGHT,
    YEARS_EXPERIENCE_BLEND_WEIGHT,
    SENIORITY_RANK,
    SYNONYM_MAP,
    VERDICT_AT_RISK,
    VERDICT_PASS,
)
from services.profile_memory.umbrella_terms import normalize_text


def _verdict_from_score(score: float) -> LayerVerdict:
    if score >= VERDICT_PASS:
        return "pass"
    if score >= VERDICT_AT_RISK:
        return "at_risk"
    return "fail"


def _verdict_from_coverage(coverage_pct: float) -> LayerVerdict:
    return _verdict_from_score(coverage_pct)


def _normalize_keyword(keyword: str) -> str:
    key = normalize_text(keyword)
    return SYNONYM_MAP.get(key, key)


def corpus_has_keyword(corpus: str, keyword: str) -> bool:
    norm = _normalize_keyword(keyword)
    if norm in corpus:
        return True
    pattern = re.escape(norm).replace(r"\ ", r"[\s_-]*")
    return bool(re.search(pattern, corpus, re.IGNORECASE))


def build_keyword_alignment_fallback(
    resume_corpus: str,
    required_skills: List[str],
    nice_to_have_skills: List[str],
) -> SemanticAlignmentResult:
    """Synthesize requirement rows from keyword matching when LLM alignment unavailable."""
    requirements: List[RequirementAlignment] = []
    seen: set[str] = set()
    for skill in list(required_skills) + list(nice_to_have_skills[:4]):
        label = skill.strip()
        if not label or label in seen:
            continue
        seen.add(label)
        if not skill.strip():
            continue
        matched = corpus_has_keyword(resume_corpus, skill)
        requirements.append(
            RequirementAlignment(
                jd_requirement=skill,
                match_status="strong" if matched else "missing",
                confidence=0.6 if matched else 0.4,
                resume_evidence=None,
                equivalent_terms_found=[],
            )
        )

    return SemanticAlignmentResult(
        requirements=requirements,
        role_relevance=RoleRelevanceSignals(),
        alignment_mode="fallback",
    )


def compute_ats_layer_from_alignment(
    alignment: SemanticAlignmentResult,
    ats_format_warnings: List[str],
) -> ATSLayerResult:
    rows = alignment.requirements
    if not rows:
        return ATSLayerResult(
            verdict="pass",
            coverage_pct=1.0,
            missing_keywords=[],
            ats_format_warnings=ats_format_warnings,
        )

    met = sum(1 for r in rows if r.match_status in ("strong", "partial"))
    coverage = met / len(rows)
    missing = [r.jd_requirement for r in rows if r.match_status == "missing"][:8]

    return ATSLayerResult(
        verdict=_verdict_from_coverage(coverage),
        coverage_pct=round(coverage, 4),
        missing_keywords=missing,
        ats_format_warnings=ats_format_warnings,
    )


def _depth_for_requirement(
    cig: CandidateIntelligenceGraph,
    requirement: str,
    *,
    include_vpm: bool,
) -> float:
    key = normalize_text(requirement)
    skills = cig.skills_merged if include_vpm else cig.skills_resume
    node = skills.get(key)
    if not node:
        for k, n in skills.items():
            if key in k or k in key:
                node = n
                break
    if not node:
        return 0.0
    return DEPTH_WEIGHTS.get(node.depth, 0.4)


def compute_hm_layer_from_alignment(
    cig: CandidateIntelligenceGraph,
    alignment: SemanticAlignmentResult,
    *,
    include_vpm: bool,
) -> HMLayerResult:
    rows = alignment.requirements
    if not rows:
        return HMLayerResult(verdict="pass", score=0.75, missing_skills=[], vpm_boostable_skills=[])

    scores: List[float] = []
    missing: List[str] = []
    for row in rows:
        match_w = MATCH_STATUS_WEIGHTS.get(row.match_status, 0.0)
        depth_w = _depth_for_requirement(cig, row.jd_requirement, include_vpm=include_vpm)
        if match_w <= 0:
            composite = 0.0
        elif depth_w > 0:
            composite = match_w * depth_w
        else:
            composite = match_w * DEPTH_WEIGHTS["listed"]
        scores.append(composite)
        if composite < DEPTH_WEIGHTS["listed"]:
            missing.append(row.jd_requirement)

    avg = sum(scores) / len(scores)

    boostable: List[str] = []
    if include_vpm:
        for row in rows:
            if row.match_status == "missing":
                continue
            key = normalize_text(row.jd_requirement)
            resume_node = cig.skills_resume.get(key)
            vpm_node = cig.skills_vpm.get(key)
            if not vpm_node:
                for k, n in cig.skills_vpm.items():
                    if key in k or k in key:
                        vpm_node = n
                        break
            if vpm_node and (not resume_node or resume_node.depth == "listed"):
                if not corpus_has_keyword(cig.resume_corpus, row.jd_requirement):
                    boostable.append(vpm_node.skill)
        boostable = list(dict.fromkeys(boostable))[:8]

    return HMLayerResult(
        verdict=_verdict_from_score(avg),
        score=round(avg, 4),
        missing_skills=missing[:8],
        vpm_boostable_skills=boostable,
    )


def _jd_seniority_tokens(target_role: str, required_skills: List[str]) -> List[str]:
    text = f"{target_role} {' '.join(required_skills)}".lower()
    tokens = []
    for level in ("intern", "junior", "mid", "senior", "lead", "staff", "principal", "director"):
        if level in text:
            tokens.append(level)
    return tokens or ["mid"]


def _title_seniority_score(cig: CandidateIntelligenceGraph, jd_levels: List[str]) -> float:
    resume_rank = SENIORITY_RANK.get(cig.seniority_level, 2)
    jd_ranks = [SENIORITY_RANK.get(level, 2) for level in jd_levels]
    target = max(jd_ranks) if jd_ranks else 2
    if resume_rank >= target:
        return 1.0
    if resume_rank == target - 1:
        return 0.55
    return 0.25


def _title_token_overlap(cig: CandidateIntelligenceGraph, target_role: str) -> float:
    role_tokens = set(re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", target_role.lower()))
    if not role_tokens:
        return 0.5
    overlap = role_tokens.intersection(set(cig.title_tokens))
    return min(1.0, len(overlap) / max(1, len(role_tokens)))


def compute_recruiter_layer(
    cig: CandidateIntelligenceGraph,
    target_role: str,
    required_skills: List[str],
) -> RecruiterLayerResult:
    jd_levels = _jd_seniority_tokens(target_role, required_skills)
    title_seniority = _title_seniority_score(cig, jd_levels)
    title_overlap = _title_token_overlap(cig, target_role)
    tenure_score = 0.35 if cig.has_tenure_gaps else 1.0
    quantified_score = 1.0 if cig.has_quantified_bullets else 0.3

    score = (
        RECRUITER_TITLE_SENIORITY_WEIGHT * title_seniority
        + RECRUITER_TITLE_TOKEN_WEIGHT * title_overlap
        + RECRUITER_TENURE_WEIGHT * tenure_score
        + RECRUITER_QUANTIFIED_WEIGHT * quantified_score
    )

    return RecruiterLayerResult(
        verdict=_verdict_from_score(score),
        score=round(score, 4),
        signals={
            "title_seniority_match": round(title_seniority, 2),
            "title_token_overlap": round(title_overlap, 2),
            "no_tenure_gaps": round(tenure_score, 2),
            "quantified_bullets": round(quantified_score, 2),
        },
    )


def apply_role_relevance_blend(
    recruiter: RecruiterLayerResult,
    role_relevance: RoleRelevanceSignals,
) -> RecruiterLayerResult:
    """Blend semantic title/domain alignment into recruiter title overlap signal."""
    title_sem = ROLE_ALIGNMENT_SCORES.get(role_relevance.title_alignment, 0.6)
    domain_sem = ROLE_ALIGNMENT_SCORES.get(role_relevance.domain_alignment, 0.6)
    semantic_blend = (title_sem * 0.6) + (domain_sem * 0.4)

    current_overlap = recruiter.signals.get("title_token_overlap", 0.5)
    blended_overlap = (
        (1.0 - ROLE_RELEVANCE_BLEND_WEIGHT) * current_overlap
        + ROLE_RELEVANCE_BLEND_WEIGHT * semantic_blend
    )

    title_seniority = recruiter.signals.get("title_seniority_match", 0.5)
    tenure_score = recruiter.signals.get("no_tenure_gaps", 1.0)
    quantified_score = recruiter.signals.get("quantified_bullets", 0.3)

    score = (
        RECRUITER_TITLE_SENIORITY_WEIGHT * title_seniority
        + RECRUITER_TITLE_TOKEN_WEIGHT * blended_overlap
        + RECRUITER_TENURE_WEIGHT * tenure_score
        + RECRUITER_QUANTIFIED_WEIGHT * quantified_score
    )

    signals = dict(recruiter.signals)
    signals["title_token_overlap"] = round(blended_overlap, 2)
    signals["semantic_title_alignment"] = round(title_sem, 2)
    signals["semantic_domain_alignment"] = round(domain_sem, 2)

    return RecruiterLayerResult(
        verdict=_verdict_from_score(score),
        score=round(score, 4),
        signals=signals,
    )


def years_match_score(required: Optional[float], candidate: Optional[float]) -> Optional[float]:
    if required is None or candidate is None:
        return None
    if candidate >= required:
        return 1.0
    if candidate >= required - 1.0:
        return 0.6
    return 0.25


def apply_years_experience_blend(
    recruiter: RecruiterLayerResult,
    years_score: Optional[float],
) -> RecruiterLayerResult:
    if years_score is None:
        return recruiter

    blended_score = (
        (1.0 - YEARS_EXPERIENCE_BLEND_WEIGHT) * recruiter.score
        + YEARS_EXPERIENCE_BLEND_WEIGHT * years_score
    )
    signals = dict(recruiter.signals)
    signals["years_experience_match"] = round(years_score, 2)

    return RecruiterLayerResult(
        verdict=_verdict_from_score(blended_score),
        score=round(blended_score, 4),
        signals=signals,
    )


def identify_bottleneck(
    ats: ATSLayerResult,
    recruiter: RecruiterLayerResult,
    hm_application: HMLayerResult,
) -> BottleneckStage:
    if ats.verdict != "pass":
        return "ats_filter"
    if recruiter.verdict != "pass":
        return "recruiter_screen"
    if hm_application.verdict != "pass":
        return "hm_review"
    return "none"
