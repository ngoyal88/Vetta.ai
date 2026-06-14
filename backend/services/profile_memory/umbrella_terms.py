from __future__ import annotations

import re
from functools import lru_cache
from typing import FrozenSet, Iterable, Optional

from config import get_settings

_DEFAULT_UMBRELLA = (
    "system design,leadership,communication,problem solving,teamwork,"
    "microservices,architecture,scalability,cloud,devops,agile,stakeholder management"
)
_DEPTH_MARKER_PATTERN = re.compile(
    r"(\d|%\s|rps\b|ms\b|latency|because|tradeoff|chose|failed|on-call|on call|\d+\s*(engineer|people|dev|developer)s?)",
    re.IGNORECASE,
)


@lru_cache(maxsize=1)
def get_umbrella_terms() -> FrozenSet[str]:
    raw = str(getattr(get_settings(), "vpm_umbrella_terms", _DEFAULT_UMBRELLA) or _DEFAULT_UMBRELLA)
    terms = {normalize_text(part) for part in raw.split(",") if part.strip()}
    return frozenset(t for t in terms if t)


def normalize_text(value: str) -> str:
    text = re.sub(r"\s+", " ", (value or "").strip().lower())
    text = re.sub(r"[^a-z0-9 +#._-]", "", text)
    return text


def is_umbrella_term(text: str, terms: Optional[Iterable[str]] = None) -> bool:
    normalized = normalize_text(text)
    if not normalized:
        return False
    umbrella = frozenset(terms) if terms is not None else get_umbrella_terms()
    if normalized in umbrella:
        return True
    return any(term in normalized for term in umbrella if " " in term or len(term) > 8)


def quote_has_depth_markers(quote: str) -> bool:
    return bool(_DEPTH_MARKER_PATTERN.search(quote or ""))


def quote_has_metric_pattern(quote: str) -> bool:
    return bool(re.search(r"\d", quote or ""))
