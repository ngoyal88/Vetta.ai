"""Derive Application Fit and Prepared Fit scores from funnel layers."""

from __future__ import annotations

from typing import Optional, Tuple

from services.jd_fit.jd_fit_models import FitBand, FunnelResult, HMLayerResult
from services.jd_fit.jd_fit_weights import (
    COMPOSITE_ATS_WEIGHT,
    COMPOSITE_HM_WEIGHT,
    COMPOSITE_RECRUITER_WEIGHT,
    FIT_BAND_COMPETITIVE_MIN,
    FIT_BAND_STRETCH_MIN,
    FIT_BAND_STRONG_MIN,
)


def _clamp_score(value: float) -> int:
    return max(0, min(100, int(round(value))))


def fit_band_from_score(score: int) -> FitBand:
    if score >= FIT_BAND_STRONG_MIN:
        return "strong"
    if score >= FIT_BAND_COMPETITIVE_MIN:
        return "competitive"
    if score >= FIT_BAND_STRETCH_MIN:
        return "stretch"
    return "long_shot"


def _composite(funnel: FunnelResult, hm: HMLayerResult) -> int:
    return _clamp_score(
        COMPOSITE_ATS_WEIGHT * (funnel.ats.coverage_pct * 100)
        + COMPOSITE_RECRUITER_WEIGHT * (funnel.recruiter.score * 100)
        + COMPOSITE_HM_WEIGHT * (hm.score * 100)
    )


def derive_scores(
    funnel: FunnelResult,
    *,
    accepted_count: int,
) -> Tuple[int, Optional[int], int, FitBand]:
    """Composite Application / Prepared Fit from funnel layers (40/30/30 weights)."""
    application_fit_score = _composite(funnel, funnel.hm_application)
    fit_band = fit_band_from_score(application_fit_score)

    if accepted_count <= 0 or funnel.hm_prepared is None:
        return application_fit_score, None, 0, fit_band

    prepared_fit_score = _composite(funnel, funnel.hm_prepared)
    # ponytail: delta is clamped at 0; no negative "prepared hurts" signal in v1
    prepared_fit_delta = max(0, prepared_fit_score - application_fit_score)
    return application_fit_score, prepared_fit_score, prepared_fit_delta, fit_band
