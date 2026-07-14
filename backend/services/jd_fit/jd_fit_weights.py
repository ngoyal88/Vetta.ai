"""Configurable weights and thresholds for JD Fit scoring."""

from typing import Dict

# Bumped: judge uses configured GROQ model (not 8B); deterministic OR/preferred repair.
SCHEMA_VERSION = 9

# Minimum JD length for LLM extraction (keep in sync with frontend JD_MIN_CHARS)
MIN_JD_CHARS = 40

# Product policy: hard-gate failures cap Application Fit % so blocked roles do not look competitive.
HARD_GATE_BLOCKED_SCORE_CAP = 44
HARD_GATE_RISKY_SCORE_CAP = 64

# Layer verdict thresholds (shared by evidence-derived funnel layers)
VERDICT_PASS = 0.70
VERDICT_AT_RISK = 0.45

# Fit bands (Application Fit score)
FIT_BAND_STRONG_MIN = 80
FIT_BAND_COMPETITIVE_MIN = 65
FIT_BAND_STRETCH_MIN = 45

BOTTLENECK_LABELS: Dict[str, str] = {
    "ats_filter": "ATS Filter",
    "recruiter_screen": "Recruiter Screen",
    "hm_review": "HM Review",
    "none": "Clear",
}
