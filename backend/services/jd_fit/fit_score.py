"""Score JD Fit from requirement-level evidence judgments."""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from services.jd_fit.jd_fit_models import (
    CategoryScore,
    GateStatus,
    HardGateFinding,
    RequirementAlignment,
    RequirementAlignmentV2,
    RequirementEvidenceResult,
    ScoreExplanation,
)
from services.jd_fit.jd_fit_weights import (
    HARD_GATE_BLOCKED_SCORE_CAP,
    HARD_GATE_RISKY_SCORE_CAP,
)
from services.jd_fit.typed_requirement_alignment import CATEGORY_GROUPS, IMPORTANCE_WEIGHT

STATUS_VALUE = {
    "met": 1.0,
    "partial": 0.6,
    "unknown": 0.25,
    "missing": 0.0,
    "not_applicable": 1.0,
}


def _row_weight(row: RequirementEvidenceResult) -> float:
    if row.weight and row.weight > 0:
        return max(0.01, float(row.weight))
    return max(0.01, IMPORTANCE_WEIGHT.get(row.importance, 1.0))


def _score(results: Sequence[RequirementEvidenceResult], *, candidate: bool) -> int:
    if not results:
        return 35
    total = 0.0
    earned = 0.0
    for row in results:
        status = row.candidate_status if candidate else row.resume_status
        weight = _row_weight(row)
        total += weight
        earned += STATUS_VALUE.get(status, 0.25) * weight
    return max(0, min(100, int(round((earned / max(total, 0.01)) * 100))))


def score_fraction_for_results(results: Sequence[RequirementEvidenceResult], *, candidate: bool = False) -> float:
    """Return 0.0–1.0 weighted score for a requirement subset (funnel layers)."""
    return _score(results, candidate=candidate) / 100.0


def apply_gate_score_caps(score: int, gate_status: GateStatus) -> int:
    if gate_status == "blocked":
        return min(score, HARD_GATE_BLOCKED_SCORE_CAP)
    if gate_status == "risky":
        return min(score, HARD_GATE_RISKY_SCORE_CAP)
    return score


def resolve_prepared_fit(
    *,
    resume_score: int,
    candidate_score: int,
    accepted_count: int,
) -> Tuple[Optional[int], int]:
    """Prepared Fit only when accepted VPM exists and candidate > resume."""
    if accepted_count <= 0:
        return None, 0
    gap = max(0, candidate_score - resume_score)
    if gap <= 0:
        return None, 0
    return candidate_score, gap


def _match_status(status: str) -> str:
    if status == "met":
        return "strong"
    if status == "partial":
        return "partial"
    if status == "missing":
        return "missing"
    return "unclear"


def evidence_results_to_legacy_alignments(
    results: Sequence[RequirementEvidenceResult],
) -> List[RequirementAlignment]:
    rows: List[RequirementAlignment] = []
    for result in results:
        evidence = result.resume_evidence.text if result.resume_evidence else None
        rows.append(
            RequirementAlignment(
                jd_requirement=result.requirement_text,
                match_status=_match_status(result.resume_status),  # type: ignore[arg-type]
                confidence=result.confidence,
                resume_evidence=evidence,
                equivalent_terms_found=[],
            )
        )
    return rows


def evidence_results_to_v2_alignments(
    base_rows: Sequence[RequirementAlignmentV2],
    results: Sequence[RequirementEvidenceResult],
) -> List[RequirementAlignmentV2]:
    by_id = {result.requirement_id: result for result in results}
    out: List[RequirementAlignmentV2] = []
    for row in base_rows:
        result = by_id.get(row.requirement.id)
        if not result:
            out.append(row)
            continue
        evidence = result.resume_evidence.text if result.resume_evidence else None
        out.append(
            RequirementAlignmentV2(
                requirement=row.requirement,
                status=result.resume_status,
                confidence=result.confidence,
                evidence=evidence,
                reason=result.reason or row.reason,
            )
        )
    return out


def _category_scores(results: Sequence[RequirementEvidenceResult]) -> List[CategoryScore]:
    grouped: Dict[str, List[RequirementEvidenceResult]] = {}
    for result in results:
        grouped.setdefault(CATEGORY_GROUPS.get(result.category, "resume_signal"), []).append(result)
    order = ["technical", "experience", "education", "certifications", "domain", "logistics", "leadership", "resume_signal"]
    scores: List[CategoryScore] = []
    for category, rows in grouped.items():
        score = round(sum(STATUS_VALUE.get(row.resume_status, 0.25) for row in rows) / max(1, len(rows)) * 100)
        scores.append(
            CategoryScore(
                category=category,  # type: ignore[arg-type]
                score=max(0, min(100, score)),
                met=sum(1 for row in rows if row.resume_status == "met"),
                partial=sum(1 for row in rows if row.resume_status == "partial"),
                missing=sum(1 for row in rows if row.resume_status == "missing"),
                unknown=sum(1 for row in rows if row.resume_status == "unknown"),
            )
        )
    return sorted(scores, key=lambda item: order.index(item.category) if item.category in order else 99)


def _gate_summary(results: Sequence[RequirementEvidenceResult], base_rows: Sequence[RequirementAlignmentV2]) -> Tuple[GateStatus, List[HardGateFinding]]:
    hard_gate_ids = {row.requirement.id: row.requirement for row in base_rows if row.requirement.is_hard_gate}
    status: GateStatus = "clear"
    findings: List[HardGateFinding] = []
    for result in results:
        requirement = hard_gate_ids.get(result.requirement_id)
        if not requirement:
            continue
        if result.resume_status == "missing":
            status = "blocked"
            findings.append(HardGateFinding(requirement=result.requirement_text, status="missing", category=result.category, reason=result.reason))
        elif result.resume_status == "unknown" and status != "blocked":
            status = "risky"
            findings.append(HardGateFinding(requirement=result.requirement_text, status="unknown", category=result.category, reason=result.reason))
    return status, findings[:8]


def _top(results: Iterable[RequirementEvidenceResult], statuses: set[str]) -> List[str]:
    return [
        result.requirement_text
        for result in results
        if result.resume_status in statuses
    ][:6]


def build_score_explanation(results: Sequence[RequirementEvidenceResult], hard_gate_findings: Sequence[HardGateFinding]) -> ScoreExplanation:
    required = [row for row in results if row.importance == "required"]
    preferred = [row for row in results if row.importance == "preferred"]
    return ScoreExplanation(
        required_met=sum(1 for row in required if row.resume_status == "met"),
        required_partial=sum(1 for row in required if row.resume_status == "partial"),
        required_missing=sum(1 for row in required if row.resume_status in {"missing", "unknown"}),
        preferred_met=sum(1 for row in preferred if row.resume_status == "met"),
        hard_gates_failed=[finding.requirement for finding in hard_gate_findings],
        top_strengths=_top(results, {"met"}),
        top_gaps=_top(results, {"missing", "unknown"}),
        evidence_summary=(
            f"{sum(1 for row in results if row.resume_status == 'met')} met, "
            f"{sum(1 for row in results if row.resume_status == 'partial')} partial, "
            f"{sum(1 for row in results if row.resume_status in {'missing', 'unknown'})} missing or unclear."
        ),
    )


def score_from_evidence_results(
    results: Sequence[RequirementEvidenceResult],
    base_rows: Sequence[RequirementAlignmentV2],
) -> Tuple[int, int, int, List[CategoryScore], GateStatus, List[HardGateFinding], ScoreExplanation]:
    gate_status, hard_gate_findings = _gate_summary(results, base_rows)
    raw_resume = _score(results, candidate=False)
    raw_candidate = max(raw_resume, _score(results, candidate=True))
    resume_score = apply_gate_score_caps(raw_resume, gate_status)
    candidate_score = max(resume_score, apply_gate_score_caps(raw_candidate, gate_status))
    gap = max(0, candidate_score - resume_score)
    category_scores = _category_scores(results)
    explanation = build_score_explanation(results, hard_gate_findings)
    for result in results:
        weight = _row_weight(result)
        delta = STATUS_VALUE.get(result.resume_status, 0.25) - 0.25
        result.score_impact = int(round(delta * weight * 10))
    return resume_score, candidate_score, gap, category_scores, gate_status, hard_gate_findings, explanation
