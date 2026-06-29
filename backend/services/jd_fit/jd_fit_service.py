"""JD Fit orchestrator."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException

from config import get_settings
from services.interview.contracts.mode_contexts import JdFitContext
from services.interview.jd_context_service import JDContextService
from services.interview.llm_engine import get_platform_llm
from services.jd_fit.action_builder import build_ranked_actions
from services.jd_fit.ats_format_checks import compute_ats_format_warnings
from services.jd_fit.candidate_graph import build_candidate_graph
from services.jd_fit.funnel_scoring import (
    apply_role_relevance_blend,
    apply_years_experience_blend,
    compute_ats_layer_from_alignment,
    compute_hm_layer_from_alignment,
    compute_recruiter_layer,
    identify_bottleneck,
    years_match_score,
)
from services.jd_fit.hash_utils import jd_hash
from services.jd_fit.jd_fit_models import (
    ComputeResponse,
    ExtractionMode,
    FunnelResult,
    HistoryResponse,
    PostingFreshness,
    RankedAction,
)
from services.jd_fit.jd_fit_repository import (
    build_inputs_digest,
    create_snapshot,
    get_cached_snapshot_id,
    get_snapshot,
    list_history,
    set_cached_snapshot_id,
)
from services.jd_fit.jd_fit_weights import (
    BOTTLENECK_LABELS,
    FUNNEL_COMPOSITE_SCORE_BLEND,
    MIN_JD_CHARS,
    TYPED_WEIGHTED_SCORE_BLEND,
)
from services.jd_fit.narrative import build_why_this_score
from services.jd_fit.profile_loader import load_resume_snapshot
from services.jd_fit.resume_compact import build_cig_summary, compact_resume_for_alignment
from services.jd_fit.score_derivation import derive_scores, fit_band_from_score
from services.jd_fit.semantic_alignment import (
    derive_skill_lists_from_alignment,
    run_semantic_alignment,
)
from services.jd_fit.typed_requirement_alignment import (
    align_typed_requirements,
    ensure_experience_requirements,
    fallback_typed_requirements,
    legacy_alignments_from_v2,
    normalize_typed_requirements,
    parse_years_from_text,
    pick_experience_years_alignment,
    summarize_v2_alignment,
)
from services.profile_memory.profile_claims_repository import get_profile_memory_summary
from utils.logger import get_logger

logger = get_logger(__name__)


async def _build_fit_extraction(
    jd_context_service: JDContextService,
    *,
    target_company: Optional[str],
    target_role: str,
    job_description: str,
    resume_data: Optional[Dict[str, Any]] = None,
    years_experience: Optional[int] = None,
) -> Tuple[JdFitContext, ExtractionMode]:
    jd_text = (job_description or "").strip()
    used_llm = len(jd_text) >= MIN_JD_CHARS

    context = await jd_context_service.build_context(
        target_company=target_company,
        target_role=target_role,
        job_description=job_description,
        interview_focus="mixed",
        resume_data=resume_data,
        years_experience=years_experience,
    )

    mode: ExtractionMode = "llm" if used_llm else "fallback"
    if used_llm and not context.get("required_skills"):
        mode = "fallback"

    try:
        return JdFitContext(**context), mode
    except Exception as exc:
        logger.warning("JdFitContext validation failed: %s", exc)
        return JdFitContext(), "fallback"


def _posting_freshness(first_seen: Optional[str]) -> Optional[PostingFreshness]:
    if not first_seen:
        return None
    try:
        seen = datetime.fromisoformat(first_seen.replace("Z", "+00:00"))
        if seen.tzinfo is None:
            seen = seen.replace(tzinfo=timezone.utc)
        hours = int((datetime.now(timezone.utc) - seen).total_seconds() // 3600)
        if hours <= 48:
            urgency = "high"
            recommendation = "Apply today — fresh postings often see higher early response rates"
        elif hours <= 168:
            urgency = "medium"
            recommendation = "Posting is still active — prioritize high-impact resume edits first"
        else:
            urgency = "low"
            recommendation = "Posting may be stale — confirm the role is still open"
        return PostingFreshness(
            first_seen=first_seen,
            hours_old=max(0, hours),
            urgency=urgency,
            recommendation=recommendation,
        )
    except Exception:
        return None


def _alignment_counts(alignment) -> tuple[int, int, int]:
    strong = partial = missing = 0
    for row in alignment.requirements:
        if row.match_status == "strong":
            strong += 1
        elif row.match_status == "partial":
            partial += 1
        elif row.match_status == "missing":
            missing += 1
    return strong, partial, missing


def _hero_verdict(*, application_score: int, bottleneck: str, gate_status: str) -> str:
    if gate_status == "blocked" or bottleneck == "ats_filter" or application_score < 50:
        return "long_shot"
    if bottleneck == "none" and gate_status == "clear" and application_score >= 75:
        return "apply_now"
    return "fix_before_apply"


def _hero_summary(
    *,
    verdict: str,
    bottleneck_label: str,
    application_score: int,
    matched_skills: list[str],
    missing_skills: list[str],
) -> str:
    if verdict == "apply_now":
        if matched_skills:
            top_skills = ", ".join(matched_skills[:3])
            return (
                f"Your resume is already telling a credible story for this role. "
                f"Core alignment is visible through {top_skills}."
            )
        return "Your resume is landing the key signals across the funnel, so this looks ready to send."
    if verdict == "long_shot":
        if missing_skills:
            top_gaps = ", ".join(missing_skills[:2])
            return (
                f"The biggest risk is at the {bottleneck_label.lower()} stage. "
                f"Right now the resume is not clearly showing enough evidence for {top_gaps}."
            )
        return (
            f"The biggest risk is at the {bottleneck_label.lower()} stage. "
            f"At {application_score}% fit, this likely needs stronger proof before you apply."
        )
    if missing_skills:
        next_gap = missing_skills[0]
        return (
            f"You're within range, but the {bottleneck_label.lower()} stage is still exposed. "
            f"Tightening evidence for {next_gap} should improve your odds fastest."
        )
    return (
        f"You're close, but the {bottleneck_label.lower()} stage still needs a clearer signal "
        f"before this feels ready to send."
    )


def _hero_primary_action_label(top_action: RankedAction | None) -> str | None:
    if top_action is None:
        return None
    if top_action.action_type == "resume_edit":
        return "Edit your resume"
    if top_action.action_type == "practice":
        return "Start a mock interview"
    if top_action.action_type == "apply":
        return "Apply now"
    return top_action.label


class JDFitService:
    def __init__(self) -> None:
        self._jd_context = JDContextService(get_platform_llm())

    async def compute_fit(
        self,
        *,
        uid: str,
        target_role: str,
        target_company: Optional[str] = None,
        job_description: str = "",
        resume_id: Optional[str] = None,
        version_id: Optional[str] = None,
        first_seen: Optional[str] = None,
    ) -> ComputeResponse:
        settings = get_settings()
        if not settings.jd_fit_enabled:
            raise HTTPException(503, "Application Fit is temporarily unavailable")

        role = (target_role or "").strip()
        if not role:
            raise HTTPException(400, detail={"code": "target_role_required", "message": "target_role is required"})

        jd_text = (job_description or "").strip()
        if len(jd_text) < MIN_JD_CHARS:
            raise HTTPException(
                400,
                detail={"code": "jd_too_short", "message": f"Job description must be at least {MIN_JD_CHARS} characters"},
            )

        profile, selected_resume_id, selected_version_id = await load_resume_snapshot(
            uid, resume_id=resume_id, version_id=version_id
        )
        if not profile:
            raise HTTPException(
                422,
                detail={
                    "code": "profile_insufficient",
                    "message": "Upload a resume to Vault to analyze application fit",
                },
            )

        started = time.perf_counter()
        warnings: list[str] = []

        try:
            profile_memory = await get_profile_memory_summary(uid)
        except Exception:
            profile_memory = {"accepted_count": 0}
            warnings.append("vpm_unavailable")

        accepted_count = int(profile_memory.get("accepted_count") or 0)
        profile_revision = str(profile_memory.get("updated_at") or accepted_count)
        digest = build_inputs_digest(
            uid,
            role,
            jd_text,
            selected_resume_id,
            selected_version_id,
            target_company=target_company,
            profile_revision=profile_revision,
        )
        cached_id = await get_cached_snapshot_id(uid, digest)
        if cached_id:
            cached = await get_snapshot(uid, cached_id)
            if cached:
                return ComputeResponse(**{k: v for k, v in cached.items() if k != "created_at"})

        cig = build_candidate_graph(uid, profile, profile_memory)

        years = profile.get("years_experience")
        years_int = int(years) if isinstance(years, (int, float)) else None

        jd_context, extraction_mode = await _build_fit_extraction(
            self._jd_context,
            target_company=target_company,
            target_role=role,
            job_description=jd_text,
            resume_data=profile,
            years_experience=years_int,
        )

        if extraction_mode == "fallback":
            warnings.append("extraction_fallback")

        typed_requirements = normalize_typed_requirements(jd_context.typed_requirements)
        if not typed_requirements:
            typed_requirements = fallback_typed_requirements(
                jd_context.required_skills,
                jd_context.nice_to_have_skills,
            )
        if not typed_requirements:
            warnings.append("typed_requirement_extraction_empty")
        typed_requirements = ensure_experience_requirements(typed_requirements, jd_text, role)
        semantic_required_skills = list(jd_context.required_skills)
        for req in typed_requirements:
            if req.category == "technical_skill" and req.importance == "required":
                semantic_required_skills.append(req.text)
        semantic_required_skills = list(dict.fromkeys(s for s in semantic_required_skills if s.strip()))

        compact_resume = compact_resume_for_alignment(profile)
        cig_summary = build_cig_summary(cig)

        alignment = await run_semantic_alignment(
            target_role=role,
            target_company=target_company,
            job_description=jd_text,
            compact_resume=compact_resume,
            cig_summary=cig_summary,
            required_skills=semantic_required_skills,
            nice_to_have_skills=jd_context.nice_to_have_skills,
            resume_corpus=cig.resume_corpus,
        )

        if alignment.alignment_mode == "fallback":
            warnings.append("alignment_fallback")

        requirement_alignments_v2 = align_typed_requirements(
            requirements=typed_requirements,
            cig=cig,
            semantic_alignment=alignment,
        )
        experience_alignment = pick_experience_years_alignment(requirement_alignments_v2)
        (
            category_scores,
            gate_status,
            hard_gate_findings,
            unknown_signals,
            score_reducers,
            score_strengths,
            typed_weighted_score,
        ) = summarize_v2_alignment(requirement_alignments_v2)

        if not alignment.requirements and requirement_alignments_v2:
            alignment.requirements = legacy_alignments_from_v2(requirement_alignments_v2)

        format_warnings = compute_ats_format_warnings(profile)
        ats = compute_ats_layer_from_alignment(alignment, format_warnings)
        recruiter = compute_recruiter_layer(cig, role, semantic_required_skills)
        recruiter = apply_role_relevance_blend(recruiter, alignment.role_relevance)
        required_years = (
            parse_years_from_text(experience_alignment.requirement.text)
            if experience_alignment
            else None
        )
        recruiter = apply_years_experience_blend(
            recruiter,
            years_match_score(required_years, cig.years_experience),
        )
        hm_application = compute_hm_layer_from_alignment(cig, alignment, include_vpm=False)

        hm_prepared = None
        vpm_boostable: list[str] = []
        if accepted_count > 0:
            hm_prepared = compute_hm_layer_from_alignment(cig, alignment, include_vpm=True)
            vpm_boostable = hm_prepared.vpm_boostable_skills

        funnel = FunnelResult(
            ats=ats,
            recruiter=recruiter,
            hm_application=hm_application,
            hm_prepared=hm_prepared,
        )

        bottleneck = identify_bottleneck(ats, recruiter, hm_application)
        bottleneck_label = BOTTLENECK_LABELS.get(bottleneck, bottleneck)

        legacy_application_score, prepared_score, prepared_delta, _fit_band = derive_scores(
            funnel, accepted_count=accepted_count
        )
        application_score = int(
            round((typed_weighted_score * TYPED_WEIGHTED_SCORE_BLEND) + (legacy_application_score * FUNNEL_COMPOSITE_SCORE_BLEND))
        )
        if "typed_requirement_extraction_empty" in warnings:
            application_score = min(application_score, 55)
        fit_band = fit_band_from_score(application_score)
        if prepared_score is not None:
            prepared_score = max(
                application_score,
                int(round((prepared_score * FUNNEL_COMPOSITE_SCORE_BLEND) + (typed_weighted_score * TYPED_WEIGHTED_SCORE_BLEND))),
            )
            prepared_delta = max(0, prepared_score - application_score)

        matched_skills, missing_skills = derive_skill_lists_from_alignment(alignment)

        ranked_actions = build_ranked_actions(
            bottleneck=bottleneck,
            funnel=funnel,
            cig=cig,
            target_role=role,
            vpm_boostable=vpm_boostable,
            requirement_alignments=alignment.requirements,
            experience_alignment=experience_alignment,
        )

        why = build_why_this_score(
            application_fit_score=application_score,
            fit_band=fit_band,
            funnel=funnel,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            bottleneck_label=bottleneck_label if bottleneck != "none" else "None — apply when ready",
            alignment_mode=alignment.alignment_mode,
            requirement_alignments=alignment.requirements,
        )
        hero_verdict = _hero_verdict(
            application_score=application_score,
            bottleneck=bottleneck,
            gate_status=gate_status,
        )
        hero_summary = _hero_summary(
            verdict=hero_verdict,
            bottleneck_label=bottleneck_label if bottleneck != "none" else "application path",
            application_score=application_score,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
        )
        hero_primary_action_label = _hero_primary_action_label(ranked_actions[0] if ranked_actions else None)

        computed_at = datetime.now(timezone.utc).isoformat()
        jd_digest = jd_hash(jd_text)

        response = ComputeResponse(
            snapshot_id="",
            bottleneck_stage=bottleneck,
            bottleneck_label=bottleneck_label if bottleneck != "none" else "Clear",
            hero_verdict=hero_verdict,
            hero_summary=hero_summary,
            hero_primary_action_label=hero_primary_action_label,
            report_mode="decision_first",
            application_fit_score=application_score,
            prepared_fit_score=prepared_score,
            prepared_fit_delta=prepared_delta,
            fit_band=fit_band,
            posting_freshness=_posting_freshness(first_seen),
            funnel=funnel,
            ranked_actions=ranked_actions,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            vpm_boostable_skills=vpm_boostable,
            why_this_score=why,
            jd_fit_context=jd_context.model_dump(),
            resume_id=selected_resume_id,
            version_id=selected_version_id,
            inputs_hash=digest,
            jd_hash=jd_digest,
            computed_at=computed_at,
            extraction_mode=extraction_mode,
            requirement_alignments=alignment.requirements,
            alignment_mode=alignment.alignment_mode,
            typed_requirements=typed_requirements,
            requirement_alignments_v2=requirement_alignments_v2,
            category_scores=category_scores,
            gate_status=gate_status,
            hard_gate_findings=hard_gate_findings,
            unknown_signals=unknown_signals,
            score_reducers=score_reducers,
            score_strengths=score_strengths,
            resume_mutation_available=False,
            warnings=warnings,
        )

        snapshot_payload: Dict[str, Any] = response.model_dump()
        snapshot_payload["target_role"] = role
        snapshot_payload["target_company"] = target_company
        snapshot_payload["job_description"] = jd_text
        snapshot_payload["accepted_count_at_compute"] = accepted_count
        snapshot_id = await create_snapshot(uid, snapshot_payload)
        response.snapshot_id = snapshot_id
        await set_cached_snapshot_id(uid, digest, snapshot_id)

        strong, partial, missing = _alignment_counts(alignment)
        latency_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "jd_fit_compute_complete uid=%s snapshot_id=%s bottleneck=%s application_score=%s "
            "prepared_score=%s extraction_mode=%s alignment_mode=%s requirements=%s "
            "strong=%s partial=%s missing=%s latency_ms=%s",
            uid,
            snapshot_id,
            bottleneck,
            application_score,
            prepared_score,
            extraction_mode,
            alignment.alignment_mode,
            len(alignment.requirements),
            strong,
            partial,
            missing,
            latency_ms,
        )

        return response

    async def get_history(
        self,
        *,
        uid: str,
        target_role: str,
        job_description: str = "",
        limit: int = 20,
    ) -> HistoryResponse:
        role = (target_role or "").strip()
        if not role:
            raise HTTPException(400, detail={"code": "target_role_required", "message": "target_role is required"})
        jd_digest = jd_hash((job_description or "").strip()) if (job_description or "").strip() else None
        entries = await list_history(uid, role, jd_digest, limit)
        return HistoryResponse(history=entries)

    async def get_snapshot_response(self, uid: str, snapshot_id: str) -> ComputeResponse:
        data = await get_snapshot(uid, snapshot_id)
        if not data:
            raise HTTPException(404, detail={"code": "snapshot_not_found", "message": "Snapshot not found"})
        data.pop("created_at", None)
        data.pop("target_company", None)
        data.pop("target_role", None)
        data.pop("job_description", None)
        data.pop("accepted_count_at_compute", None)
        return ComputeResponse(**data)
