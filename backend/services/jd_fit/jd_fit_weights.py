"""Configurable weights and thresholds for JD Fit scoring."""

from typing import Dict

SCHEMA_VERSION = 4

# Minimum JD length for LLM extraction (keep in sync with frontend JD_MIN_CHARS)
MIN_JD_CHARS = 40

# Application Fit % = typed alignment blend + funnel composite blend
TYPED_WEIGHTED_SCORE_BLEND = 0.6
FUNNEL_COMPOSITE_SCORE_BLEND = 0.4

# Composite score derivation (Application / Prepared Fit)
COMPOSITE_ATS_WEIGHT = 0.40
COMPOSITE_RECRUITER_WEIGHT = 0.30
COMPOSITE_HM_WEIGHT = 0.30

# Layer verdict thresholds
VERDICT_PASS = 0.70
VERDICT_AT_RISK = 0.45

# Recruiter layer signal weights
RECRUITER_TITLE_SENIORITY_WEIGHT = 0.45
RECRUITER_TITLE_TOKEN_WEIGHT = 0.25
RECRUITER_TENURE_WEIGHT = 0.15
RECRUITER_QUANTIFIED_WEIGHT = 0.15

# HM depth weights
DEPTH_WEIGHTS: Dict[str, float] = {
    "production": 1.0,
    "evidenced": 0.7,
    "listed": 0.4,
}

# Fit bands (Application Fit score)
FIT_BAND_STRONG_MIN = 80
FIT_BAND_COMPETITIVE_MIN = 65
FIT_BAND_STRETCH_MIN = 45

# Static synonym map for ATS keyword matching (Phase 1 seed)
SYNONYM_MAP: Dict[str, str] = {
    "k8s": "kubernetes",
    "kube": "kubernetes",
    "js": "javascript",
    "ts": "typescript",
    "node": "nodejs",
    "node.js": "nodejs",
    "postgres": "postgresql",
    "pg": "postgresql",
    "aws": "amazon web services",
    "gcp": "google cloud",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "react.js": "react",
    "vue.js": "vue",
}

SENIORITY_RANK: Dict[str, int] = {
    "intern": 0,
    "junior": 1,
    "mid": 2,
    "middle": 2,
    "senior": 3,
    "lead": 4,
    "staff": 5,
    "principal": 6,
    "director": 7,
    "unknown": 2,
}

MATCH_STATUS_WEIGHTS: Dict[str, float] = {
    "strong": 1.0,
    "partial": 0.55,
    "unclear": 0.35,
    "missing": 0.0,
}

ROLE_ALIGNMENT_SCORES: Dict[str, float] = {
    "strong": 1.0,
    "partial": 0.6,
    "weak": 0.3,
}

ROLE_RELEVANCE_BLEND_WEIGHT = 0.30
YEARS_EXPERIENCE_BLEND_WEIGHT = 0.20

BOTTLENECK_LABELS: Dict[str, str] = {
    "ats_filter": "ATS Filter",
    "recruiter_screen": "Recruiter Screen",
    "hm_review": "HM Review",
    "none": "Clear",
}
