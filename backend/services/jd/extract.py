"""Shared JD text normalization kernel — used by jd_fit and interview JD context."""
from __future__ import annotations

from services.interview.jd_context_service import clean_optional_text
from services.jd_fit.jd_fit_weights import MIN_JD_CHARS

__all__ = ["MIN_JD_CHARS", "clean_optional_text", "normalize_jd_text"]


def normalize_jd_text(value: str | None, *, max_len: int = 8000) -> str | None:
    """Collapse whitespace and cap length for LLM token efficiency."""
    return clean_optional_text(value, max_len=max_len)
