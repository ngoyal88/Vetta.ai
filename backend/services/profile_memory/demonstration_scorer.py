from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, Set

from services.profile_memory.models import GAP_CATEGORY
from services.profile_memory.umbrella_terms import (
    get_umbrella_terms,
    is_umbrella_term,
    normalize_text,
    quote_has_metric_pattern,
)

_CAUSAL_PATTERN = re.compile(
    r"\b(because|tradeoff|trade-off|chose|chosen|decided|failed|on-call|on call)\b",
    re.IGNORECASE,
)
_UNIT_PATTERN = re.compile(r"\b(rps|ms|latency|p99|p95|qps|tps|gb|mb|kb)\b", re.IGNORECASE)
_MULTI_CLAUSE_PATTERN = re.compile(r"[.;]| because ", re.IGNORECASE)


@dataclass
class DemonstrationScore:
    score: float
    passed: bool
    signals: Dict[str, bool] = field(default_factory=dict)
    reason: str = ""


def _fuzzy_substring_match(needle: str, haystack: str, min_ratio: float = 0.85) -> bool:
    # ponytail: fuzzy quote match ~85% char overlap, not semantic; upgrade to embedding match if false positives grow
    if not needle or not haystack:
        return False
    if needle in haystack:
        return True
    n_len = len(needle)
    if n_len < 20:
        return False
    window = max(n_len, int(n_len * 1.1))
    step = max(1, n_len // 8)
    for i in range(0, max(1, len(haystack) - n_len + 1), step):
        chunk = haystack[i : i + window]
        if not chunk:
            continue
        overlap = sum(1 for a, b in zip(needle, chunk[:n_len]) if a == b)
        if overlap / n_len >= min_ratio:
            return True
    return False


def quote_grounded_in_transcript(quote: str, transcript_normalized: str) -> bool:
    q = normalize_text(quote)
    if not q or not transcript_normalized:
        return False
    return _fuzzy_substring_match(q, transcript_normalized)


def _is_resume_redundant(
    claim_text: str,
    normalized_key: str,
    quote: str,
    resume_known: Dict[str, Set[str]],
) -> bool:
    skills = resume_known.get("skills") or set()
    projects = resume_known.get("projects") or set()
    text_blobs = resume_known.get("text") or set()

    if normalized_key in skills or normalized_key in projects:
        return not quote_has_metric_pattern(quote)

    normalized_claim = normalize_text(claim_text)
    for blob in text_blobs:
        if not blob:
            continue
        if normalized_claim and normalized_claim in blob:
            return not quote_has_metric_pattern(quote)
        if len(normalized_claim) > 12 and normalized_claim in blob:
            return not quote_has_metric_pattern(quote)
    return False


def score_demonstration(
    claim_text: str,
    evidence_quote: str,
    *,
    claim_category: str,
    demonstration_strength: str,
    transcript_normalized: str,
    resume_known: Dict[str, Set[str]],
) -> DemonstrationScore:
    quote = (evidence_quote or "").strip()
    text = (claim_text or "").strip()
    normalized_key = normalize_text(text)
    strength = str(demonstration_strength or "").lower()
    category = claim_category

    signals: Dict[str, bool] = {
        "quote_min_length": len(quote) >= 40,
        "multi_clause": bool(_MULTI_CLAUSE_PATTERN.search(quote)),
        "quantified": bool(quote_has_metric_pattern(quote)) or bool(_UNIT_PATTERN.search(quote)),
        "causal_language": bool(_CAUSAL_PATTERN.search(quote)),
        "grounded_in_transcript": quote_grounded_in_transcript(quote, transcript_normalized),
        "resume_redundant": _is_resume_redundant(text, normalized_key, quote, resume_known),
    }

    umbrella_terms = get_umbrella_terms()
    signals["umbrella_label"] = is_umbrella_term(text, umbrella_terms)
    token_count = len(normalized_key.split())
    signals["specific_claim"] = token_count >= 3 or (
        not signals["umbrella_label"] and len(normalized_key) >= 12
    )

    if not text or not normalized_key:
        return DemonstrationScore(0.0, False, signals, "empty_claim")

    if not signals["quote_min_length"]:
        return DemonstrationScore(0.1, False, signals, "g1_quote_too_short")

    if strength in {"weak", "none"}:
        if category == GAP_CATEGORY and strength == "weak":
            if signals["grounded_in_transcript"]:
                return DemonstrationScore(0.6, True, signals, "gap_weak")
            return DemonstrationScore(0.3, False, signals, "g8_quote_not_in_transcript")
        return DemonstrationScore(0.2, False, signals, "g2_weak_or_none")

    if not signals["grounded_in_transcript"]:
        return DemonstrationScore(0.2, False, signals, "g8_quote_not_in_transcript")

    if signals["resume_redundant"]:
        return DemonstrationScore(0.3, False, signals, "g7_resume_redundant")

    depth_signals = sum(
        1
        for key in ("multi_clause", "quantified", "causal_language", "specific_claim")
        if signals.get(key)
    )

    if category == "technical" and signals["umbrella_label"] and depth_signals < 2:
        return DemonstrationScore(0.35, False, signals, "g3_g4_umbrella_without_depth")

    if depth_signals < 1 and category != GAP_CATEGORY:
        return DemonstrationScore(0.4, False, signals, "insufficient_demonstration_depth")

    score = min(1.0, 0.35 + 0.15 * depth_signals + (0.1 if signals["grounded_in_transcript"] else 0))
    return DemonstrationScore(score, True, signals, "passed")
