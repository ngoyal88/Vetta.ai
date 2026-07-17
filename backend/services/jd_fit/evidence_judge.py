"""Batched evidence adjudication for JD Fit requirements."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Sequence, Tuple

from services.platform.llm import get_platform_llm
from services.interview.prompt_contracts import extract_json_dict
from services.jd_fit.jd_fit_models import (
    EvidenceChunk,
    RequirementAlignmentStatus,
    RequirementEvidenceResult,
    TypedRequirement,
)
from services.jd_fit.typed_requirement_alignment import format_requirement_label
from utils.logger import get_logger

logger = get_logger(__name__)

MAX_REQUIREMENTS_PER_BATCH = 20
VALID_STATUSES = {"met", "partial", "missing", "unknown", "not_applicable"}

_JUDGE_SYSTEM_PROMPT = (
    "You judge whether resume and verified profile evidence satisfies job requirements. Return ONLY JSON: "
    "{\"results\":[{\"requirement_id\":string,\"resume_status\":\"met|partial|missing|unknown|not_applicable\","
    "\"candidate_status\":\"met|partial|missing|unknown|not_applicable\",\"confidence\":number,"
    "\"best_resume_evidence_id\":string|null,\"best_memory_evidence_id\":string|null,\"reason\":string}]}.\n"
    "Rules:\n"
    "- resume_status may use only resume-sourced evidence (visible_on_resume=true).\n"
    "- candidate_status may use resume evidence plus verified profile_memory evidence.\n"
    "- candidate_status may exceed resume_status only when citing profile_memory evidence.\n"
    "- met/partial must cite an evidence id from the provided corpus.\n"
    "- For satisfy_mode \"any\", mark met/partial if evidence supports ANY ONE of text or alternatives; "
    "cite the evidence that matched.\n"
    "- You may recognize well-established, unambiguous technical implications (e.g. demonstrated FastAPI or "
    "Django use implies Python proficiency; PostgreSQL or MySQL use implies SQL proficiency). Only apply when "
    "the implication is a standard, widely-recognized technical fact, and always cite the specific evidence.\n"
    "- Prefer partial over met when evidence is related but not direct.\n"
    "- For experience/years requirements, use work history dates and role tenure on the resume; "
    "overlapping internships and consecutive roles count toward total experience.\n"
    "- Do not invent evidence or ask questions."
)


def _status_score(status: str) -> float:
    return {
        "met": 1.0,
        "partial": 0.6,
        "unknown": 0.35,
        "missing": 0.0,
        "not_applicable": 1.0,
    }.get(status, 0.35)


def _chunk_lookup(evidence_corpus: Sequence[EvidenceChunk]) -> Dict[str, EvidenceChunk]:
    return {chunk.id: chunk for chunk in evidence_corpus}


def _coerce_status(value: Any) -> RequirementAlignmentStatus:
    status = str(value or "unknown").strip().lower()
    if status not in VALID_STATUSES:
        status = "unknown"
    return status  # type: ignore[return-value]


def _filter_evidence(
    resume_evidence: Optional[EvidenceChunk],
    memory_evidence: Optional[EvidenceChunk],
) -> tuple[Optional[EvidenceChunk], Optional[EvidenceChunk]]:
    if resume_evidence is not None and resume_evidence.source != "resume":
        resume_evidence = None
    if memory_evidence is not None and memory_evidence.source != "profile_memory":
        memory_evidence = None
    return resume_evidence, memory_evidence


def reconcile_statuses(
    resume_status: RequirementAlignmentStatus,
    candidate_status: RequirementAlignmentStatus,
    resume_evidence: Optional[EvidenceChunk],
    memory_evidence: Optional[EvidenceChunk],
) -> tuple[RequirementAlignmentStatus, RequirementAlignmentStatus]:
    """Enforce evidence citations and prevent candidate inflation without VPM."""
    if resume_status in {"met", "partial"} and not resume_evidence:
        resume_status = "unknown"
    if candidate_status in {"met", "partial"} and not (resume_evidence or memory_evidence):
        candidate_status = "unknown"

    if _status_score(candidate_status) > _status_score(resume_status) and not memory_evidence:
        candidate_status = resume_status
    if _status_score(candidate_status) < _status_score(resume_status):
        candidate_status = resume_status
    return resume_status, candidate_status


def _make_result(
    requirement: TypedRequirement,
    *,
    resume_status: RequirementAlignmentStatus,
    candidate_status: RequirementAlignmentStatus,
    confidence: float,
    resume_evidence: Optional[EvidenceChunk],
    memory_evidence: Optional[EvidenceChunk],
    reason: str,
) -> RequirementEvidenceResult:
    resume_evidence, memory_evidence = _filter_evidence(resume_evidence, memory_evidence)
    resume_status, candidate_status = reconcile_statuses(
        resume_status,
        candidate_status,
        resume_evidence,
        memory_evidence,
    )
    return RequirementEvidenceResult(
        requirement_id=requirement.id,
        requirement_text=format_requirement_label(requirement.text, requirement.alternatives, requirement.satisfy_mode),
        category=requirement.category,
        importance=requirement.importance,
        alternatives=list(requirement.alternatives),
        satisfy_mode=requirement.satisfy_mode,
        funnel_stage=requirement.funnel_stage,
        weight=requirement.weight,
        resume_status=resume_status,
        candidate_status=candidate_status,
        confidence=confidence,
        resume_evidence=resume_evidence,
        memory_evidence=memory_evidence,
        reason=reason,
    )


def _unavailable_results(requirements: Sequence[TypedRequirement]) -> List[RequirementEvidenceResult]:
    return [
        _make_result(
            requirement,
            resume_status="unknown",
            candidate_status="unknown",
            confidence=0.35,
            resume_evidence=None,
            memory_evidence=None,
            reason="Evidence adjudication was unavailable; status is unknown.",
        )
        for requirement in requirements
    ]


def _build_user_prompt(
    requirements: Sequence[TypedRequirement],
    evidence_corpus: Sequence[EvidenceChunk],
) -> str:
    payload = {
        "requirements": [
            {
                "id": req.id,
                "category": req.category,
                "text": req.text,
                "alternatives": req.alternatives,
                "satisfy_mode": req.satisfy_mode,
                "importance": req.importance,
                "strictness": req.strictness,
                "funnel_stage": req.funnel_stage,
                "is_hard_gate": req.is_hard_gate,
            }
            for req in requirements
        ],
        "evidence_corpus": [
            {
                "id": chunk.id,
                "source": chunk.source,
                "section": chunk.section,
                "label": chunk.label,
                "visible_on_resume": chunk.visible_on_resume,
                "verified": chunk.verified,
                "text": chunk.text,
            }
            for chunk in evidence_corpus
        ],
    }
    return json.dumps(payload, ensure_ascii=True)


def _parse_llm_results(
    payload: Dict[str, Any],
    requirements: Sequence[TypedRequirement],
    evidence_corpus: Sequence[EvidenceChunk],
) -> List[RequirementEvidenceResult]:
    by_req = {req.id: req for req in requirements}
    chunks = _chunk_lookup(evidence_corpus)
    results: List[RequirementEvidenceResult] = []
    raw_results = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(raw_results, list):
        return []

    for raw in raw_results:
        if not isinstance(raw, dict):
            continue
        req_id = str(raw.get("requirement_id") or "").strip()
        req = by_req.get(req_id)
        if req is None:
            continue
        resume_evidence = chunks.get(str(raw.get("best_resume_evidence_id") or ""))
        memory_evidence = chunks.get(str(raw.get("best_memory_evidence_id") or ""))
        resume_status = _coerce_status(raw.get("resume_status"))
        candidate_status = _coerce_status(raw.get("candidate_status"))
        confidence = raw.get("confidence")
        confidence_value = max(0.0, min(1.0, float(confidence))) if isinstance(confidence, (int, float)) else 0.5
        results.append(
            _make_result(
                req,
                resume_status=resume_status,
                candidate_status=candidate_status,
                confidence=confidence_value,
                resume_evidence=resume_evidence,
                memory_evidence=memory_evidence,
                reason=str(raw.get("reason") or "").strip()[:500],
            )
        )
    return results


def _batch_requirements(requirements: Sequence[TypedRequirement]) -> List[List[TypedRequirement]]:
    batches: List[List[TypedRequirement]] = []
    rows = list(requirements)
    for index in range(0, len(rows), MAX_REQUIREMENTS_PER_BATCH):
        batches.append(rows[index : index + MAX_REQUIREMENTS_PER_BATCH])
    return batches


async def _judge_batch(
    requirements: Sequence[TypedRequirement],
    evidence_corpus: Sequence[EvidenceChunk],
) -> Tuple[List[RequirementEvidenceResult], bool]:
    if not requirements:
        return [], False

    try:
        raw = await get_platform_llm().json_completion(
            _JUDGE_SYSTEM_PROMPT,
            _build_user_prompt(requirements, evidence_corpus),
        )
        payload = extract_json_dict(raw)
        parsed = _parse_llm_results(payload, requirements, evidence_corpus)
        if not parsed:
            return _unavailable_results(requirements), True

        by_id = {row.requirement_id: row for row in parsed}
        missing = [req for req in requirements if req.id not in by_id]
        if missing:
            parsed.extend(_unavailable_results(missing))
        return parsed, False
    except Exception as exc:
        logger.warning("Evidence judge batch failed: %s", exc, exc_info=True)
        return _unavailable_results(requirements), True


async def judge_requirement_evidence(
    requirements: Sequence[TypedRequirement],
    evidence_corpus: Sequence[EvidenceChunk],
) -> tuple[List[RequirementEvidenceResult], str, bool]:
    """Adjudicate all requirements against the full evidence corpus."""
    if not requirements:
        return [], "fallback", False

    batches = _batch_requirements(requirements)
    merged: List[RequirementEvidenceResult] = []
    any_unavailable = False

    for batch in batches:
        rows, unavailable = await _judge_batch(batch, evidence_corpus)
        merged.extend(rows)
        any_unavailable = any_unavailable or unavailable

    if any_unavailable and not merged:
        return _unavailable_results(requirements), "fallback", True

    alignment_mode = "fallback" if any_unavailable else "llm"
    return merged, alignment_mode, any_unavailable
