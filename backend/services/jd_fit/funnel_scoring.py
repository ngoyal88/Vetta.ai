"""Funnel layer scoring derived from evidence adjudication results."""

from __future__ import annotations

from typing import List, Sequence

from services.jd_fit.fit_score import score_fraction_for_results
from services.jd_fit.jd_fit_models import (
    ATSLayerResult,
    BottleneckStage,
    FunnelResult,
    HMLayerResult,
    LayerVerdict,
    RecruiterLayerResult,
    RequirementEvidenceResult,
)
from services.jd_fit.jd_fit_weights import VERDICT_AT_RISK, VERDICT_PASS


def _verdict_from_score(score: float) -> LayerVerdict:
    if score >= VERDICT_PASS:
        return "pass"
    if score >= VERDICT_AT_RISK:
        return "at_risk"
    return "fail"


def _stage_rows(
    results: Sequence[RequirementEvidenceResult],
    stage: str,
) -> List[RequirementEvidenceResult]:
    return [row for row in results if row.funnel_stage == stage]


def _layer_from_stage(
    results: Sequence[RequirementEvidenceResult],
    stage: str,
    *,
    candidate: bool = False,
) -> tuple[LayerVerdict, float, List[str]]:
    rows = _stage_rows(results, stage)
    if not rows:
        return "pass", 1.0, []

    score = score_fraction_for_results(rows, candidate=candidate)
    met = sum(
        1
        for row in rows
        if (row.candidate_status if candidate else row.resume_status) in {"met", "partial", "not_applicable"}
    )
    coverage = met / len(rows)
    missing = [
        row.requirement_text
        for row in rows
        if (row.candidate_status if candidate else row.resume_status) in {"missing", "unknown"}
    ][:8]
    required_missing = any(
        row.importance == "required"
        and (row.candidate_status if candidate else row.resume_status) in {"missing", "unknown"}
        for row in rows
    )
    verdict = _verdict_from_score(score)
    # A missing required requirement cannot score a clean pass for that screen.
    if required_missing and verdict == "pass":
        verdict = "at_risk"
    return verdict, round(coverage, 4), missing


def _vpm_boostable(results: Sequence[RequirementEvidenceResult]) -> List[str]:
    boostable: List[str] = []
    for row in results:
        if row.resume_status in {"met", "partial", "not_applicable"}:
            continue
        if row.candidate_status in {"met", "partial"} and row.memory_evidence is not None:
            boostable.append(row.requirement_text)
    return list(dict.fromkeys(boostable))[:8]


def compute_funnel_from_evidence_results(
    results: Sequence[RequirementEvidenceResult],
    ats_format_warnings: List[str],
    *,
    include_prepared: bool = False,
) -> FunnelResult:
    ats_verdict, ats_coverage, ats_missing = _layer_from_stage(results, "ats_filter", candidate=False)
    recruiter_verdict, recruiter_coverage, _ = _layer_from_stage(results, "recruiter_screen", candidate=False)
    hm_verdict, hm_coverage, hm_missing = _layer_from_stage(results, "hm_review", candidate=False)

    ats = ATSLayerResult(
        verdict=ats_verdict,
        coverage_pct=ats_coverage,
        missing_keywords=ats_missing,
        ats_format_warnings=ats_format_warnings,
    )
    recruiter = RecruiterLayerResult(
        verdict=recruiter_verdict,
        score=round(score_fraction_for_results(_stage_rows(results, "recruiter_screen"), candidate=False), 4),
        signals={"coverage_pct": round(recruiter_coverage, 4)},
    )
    hm_application = HMLayerResult(
        verdict=hm_verdict,
        score=round(score_fraction_for_results(_stage_rows(results, "hm_review"), candidate=False), 4),
        missing_skills=hm_missing,
        vpm_boostable_skills=[],
    )

    hm_prepared = None
    if include_prepared:
        prepared_verdict, _, prepared_missing = _layer_from_stage(results, "hm_review", candidate=True)
        hm_prepared = HMLayerResult(
            verdict=prepared_verdict,
            score=round(score_fraction_for_results(_stage_rows(results, "hm_review"), candidate=True), 4),
            missing_skills=prepared_missing,
            vpm_boostable_skills=_vpm_boostable(results),
        )

    return FunnelResult(
        ats=ats,
        recruiter=recruiter,
        hm_application=hm_application,
        hm_prepared=hm_prepared,
    )


def compute_ats_layer_from_alignment(alignment, ats_format_warnings: List[str]) -> ATSLayerResult:
    """Legacy helper kept for tests — empty alignment is not a free pass."""
    rows = alignment.requirements
    if not rows:
        return ATSLayerResult(
            verdict="at_risk",
            coverage_pct=0.0,
            missing_keywords=[],
            ats_format_warnings=ats_format_warnings,
        )
    met = sum(1 for row in rows if row.match_status in ("strong", "partial"))
    coverage = met / len(rows)
    missing = [row.jd_requirement for row in rows if row.match_status == "missing"][:8]
    return ATSLayerResult(
        verdict=_verdict_from_score(coverage),
        coverage_pct=round(coverage, 4),
        missing_keywords=missing,
        ats_format_warnings=ats_format_warnings,
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
