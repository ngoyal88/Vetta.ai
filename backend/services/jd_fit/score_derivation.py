"""Shared Application Fit band helpers."""

from __future__ import annotations

from services.jd_fit.jd_fit_models import FitBand
from services.jd_fit.jd_fit_weights import (
    FIT_BAND_COMPETITIVE_MIN,
    FIT_BAND_STRETCH_MIN,
    FIT_BAND_STRONG_MIN,
)


def fit_band_from_score(score: int) -> FitBand:
    if score >= FIT_BAND_STRONG_MIN:
        return "strong"
    if score >= FIT_BAND_COMPETITIVE_MIN:
        return "competitive"
    if score >= FIT_BAND_STRETCH_MIN:
        return "stretch"
    return "long_shot"
