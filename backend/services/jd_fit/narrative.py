"""Template narrative for why_this_score — no LLM in P1."""

from __future__ import annotations

from typing import List, Optional

from services.jd_fit.jd_fit_models import AlignmentMode, FitBand, FunnelResult, RequirementAlignment


def build_why_this_score(
    *,
    application_fit_score: int,
    fit_band: FitBand,
    funnel: FunnelResult,
    matched_skills: List[str],
    missing_skills: List[str],
    bottleneck_label: str,
    alignment_mode: AlignmentMode = "fallback",
    requirement_alignments: Optional[List[RequirementAlignment]] = None,
) -> str:
    band_phrase = {
        "strong": "strong alignment",
        "competitive": "competitive alignment",
        "stretch": "stretch alignment",
        "long_shot": "long-shot alignment",
    }.get(fit_band, "mixed alignment")

    rows = requirement_alignments or []
    total = len(rows)
    met = sum(1 for r in rows if r.match_status in ("strong", "partial"))

    coverage_label = "Requirement alignment" if alignment_mode == "llm" else "Keyword coverage"
    coverage_pct = int(funnel.ats.coverage_pct * 100)

    parts = [
        f"Application fit is {application_fit_score}% ({band_phrase}).",
        f"Primary blocker: {bottleneck_label}.",
    ]

    if total > 0:
        parts.append(f"Requirements met: {met} of {total} ({coverage_label.lower()} {coverage_pct}%).")
    else:
        parts.append(f"{coverage_label} is {coverage_pct}%.")

    if matched_skills:
        parts.append(f"Strong matches include {', '.join(matched_skills[:4])}.")
    if missing_skills:
        parts.append(f"Top gaps: {', '.join(missing_skills[:4])}.")

    partial_with_evidence = next(
        (r for r in rows if r.match_status == "partial" and r.resume_evidence),
        None,
    )
    if partial_with_evidence and partial_with_evidence.resume_evidence:
        snippet = partial_with_evidence.resume_evidence[:80]
        parts.append(
            f"Partial gap on {partial_with_evidence.jd_requirement} — existing evidence: \"{snippet}...\"."
        )

    return " ".join(parts)
