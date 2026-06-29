"""Build ranked actions from bottleneck and layer gaps."""

from __future__ import annotations

from typing import List, Optional

from services.jd_fit.candidate_graph import CandidateIntelligenceGraph
from services.jd_fit.jd_fit_models import (
    ATSLayerResult,
    BottleneckStage,
    FunnelResult,
    HMLayerResult,
    RankedAction,
    RecruiterLayerResult,
    RequirementAlignment,
    RequirementAlignmentV2,
)
from services.jd_fit.typed_requirement_alignment import parse_years_from_text


def build_ranked_actions(
    *,
    bottleneck: BottleneckStage,
    funnel: FunnelResult,
    cig: CandidateIntelligenceGraph,
    target_role: str,
    vpm_boostable: List[str],
    requirement_alignments: List[RequirementAlignment] | None = None,
    experience_alignment: RequirementAlignmentV2 | None = None,
) -> List[RankedAction]:
    actions: List[RankedAction] = []
    alignments = requirement_alignments or []

    if bottleneck == "ats_filter":
        actions.extend(_ats_actions(funnel.ats, alignments))
    elif bottleneck == "recruiter_screen":
        actions.extend(_recruiter_actions(funnel.recruiter, target_role, cig))
        years_action = _experience_years_action(experience_alignment)
        if years_action:
            actions.append(years_action)
    elif bottleneck == "hm_review":
        actions.extend(_hm_actions(funnel.hm_application, alignments=alignments))
    else:
        actions.append(
            RankedAction(
                priority="MEDIUM",
                label="Apply when ready",
                detail="You're clear across ATS, recruiter scan, and skill depth signals.",
                estimated_impact="Strong alignment for this posting",
                action_type="apply",
            )
        )

    for skill in vpm_boostable[:2]:
        actions.append(
            RankedAction(
                priority="HIGH",
                label=f"Surface {skill} from verified practice on your resume",
                detail="You have verified evidence that is not yet visible on your resume.",
                estimated_impact="Closes requirement gap and improves HM depth",
                action_type="resume_edit",
                vpm_evidence_available=True,
            )
        )

    for skill in funnel.hm_application.missing_skills[:2]:
        if any(a.label.lower().find(skill.lower()) >= 0 for a in actions):
            continue
        actions.append(
            RankedAction(
                priority="MEDIUM",
                label=f"Practice {skill} gap",
                detail=f"Build verified evidence for {skill} before HM review.",
                estimated_impact="Build verified evidence for HM review",
                action_type="practice",
            )
        )

    return _dedupe_and_cap(actions, limit=6)


def _ats_actions(
    ats: ATSLayerResult,
    alignments: List[RequirementAlignment],
) -> List[RankedAction]:
    actions: List[RankedAction] = []
    missing_rows = [r for r in alignments if r.match_status == "missing"]
    missing_labels = [r.jd_requirement for r in missing_rows] or ats.missing_keywords

    for label in missing_labels[:3]:
        actions.append(
            RankedAction(
                priority="CRITICAL",
                label=f"Demonstrate {label} on your resume if accurate",
                detail=f"Requirement gap detected for '{label}'.",
                estimated_impact="Improves requirement alignment coverage",
                action_type="resume_edit",
            )
        )
    for warning in ats.ats_format_warnings[:1]:
        actions.append(
            RankedAction(
                priority="HIGH",
                label="Fix resume formatting signal",
                detail=warning,
                estimated_impact="Improves ATS parse quality",
                action_type="resume_edit",
            )
        )
    return actions


def _recruiter_actions(
    recruiter: RecruiterLayerResult,
    target_role: str,
    cig: CandidateIntelligenceGraph,
) -> List[RankedAction]:
    actions: List[RankedAction] = []
    seniority = recruiter.signals.get("title_seniority_match", 1.0)
    if seniority < 0.6:
        actions.append(
            RankedAction(
                priority="CRITICAL",
                label=f"Align title framing with '{target_role}'",
                detail="Your current seniority signals may not match what recruiters scan for.",
                estimated_impact="Likely improves recruiter scan signals",
                action_type="resume_edit",
            )
        )
    if not cig.has_quantified_bullets:
        actions.append(
            RankedAction(
                priority="HIGH",
                label="Add quantified impact to recent role bullets",
                detail="Recruiter scans favor measurable outcomes in the first roles they read.",
                estimated_impact="Likely improves recruiter scan signals",
                action_type="resume_edit",
            )
        )
    if cig.has_tenure_gaps:
        actions.append(
            RankedAction(
                priority="MEDIUM",
                label="Address tenure gap narrative in summary",
                detail="Gaps over six months may trigger recruiter filters.",
                estimated_impact="Reduces recruiter screen risk",
                action_type="resume_edit",
            )
        )
    return actions


def _experience_years_action(
    alignment: RequirementAlignmentV2 | None,
) -> Optional[RankedAction]:
    if alignment is None or alignment.requirement.category != "experience":
        return None
    required = parse_years_from_text(alignment.requirement.text)
    if required is None or alignment.status not in ("partial", "missing"):
        return None
    candidate_text = alignment.evidence or "not shown"
    return RankedAction(
        priority="HIGH",
        label=f"JD asks for {required:g}+ years — profile shows {candidate_text}",
        detail=(
            "Strengthen your summary and role dates so total experience is visible to recruiters. "
            f"{alignment.reason}"
        ),
        estimated_impact="Likely improves recruiter experience alignment",
        action_type="resume_edit",
    )


def _hm_actions(
    hm: HMLayerResult,
    *,
    alignments: List[RequirementAlignment],
) -> List[RankedAction]:
    actions: List[RankedAction] = []
    partial_rows = [r for r in alignments if r.match_status == "partial"]

    for row in partial_rows[:2]:
        detail = f"HM review looks for stronger evidence on {row.jd_requirement}."
        if row.resume_evidence:
            detail = f"{detail} You have partial evidence: \"{row.resume_evidence[:120]}...\""
        actions.append(
            RankedAction(
                priority="MEDIUM",
                label=f"Strengthen evidence for {row.jd_requirement}",
                detail=detail,
                estimated_impact="Improves HM skill depth signal",
                action_type="resume_edit",
            )
        )

    for skill in hm.missing_skills[:3]:
        if any(skill.lower() in a.label.lower() for a in actions):
            continue
        actions.append(
            RankedAction(
                priority="MEDIUM",
                label=f"Strengthen {skill} depth on resume",
                detail=f"HM review looks for demonstrated depth on {skill}.",
                estimated_impact="Improves HM skill depth signal",
                action_type="resume_edit",
            )
        )
    return actions


def _dedupe_and_cap(actions: List[RankedAction], limit: int) -> List[RankedAction]:
    seen: set[str] = set()
    out: List[RankedAction] = []
    for action in actions:
        key = action.label.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(action)
        if len(out) >= limit:
            break
    return out
