"""Ephemeral JD file text extraction (no persistence)."""

from __future__ import annotations

import re
from typing import List, Tuple

from fastapi import HTTPException

from services.resume.resume_parser import extract_text_with_metadata

JD_EXTRACT_MAX_BYTES = 2 * 1024 * 1024
JD_EXTRACT_MAX_CHARS = 8000

_ALLOWED_JD_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}


def _normalize_jd_text(raw: str) -> str:
    """Collapse all whitespace to single spaces for LLM token efficiency."""
    collapsed = re.sub(r"\s+", " ", raw or "").strip()
    return collapsed[:JD_EXTRACT_MAX_CHARS]


def _allowed_jd_filename(filename: str) -> bool:
    lower = (filename or "").lower().strip()
    return any(lower.endswith(ext) for ext in _ALLOWED_JD_EXTENSIONS)


def extract_jd_text_from_bytes(blob: bytes, filename: str) -> Tuple[str, List[str]]:
    """Extract JD plain text from an uploaded file blob. Raises HTTPException on failure."""
    if not blob:
        raise HTTPException(400, "empty file")
    if len(blob) > JD_EXTRACT_MAX_BYTES:
        raise HTTPException(413, "File too large. Max size 2 MB.")

    safe_name = (filename or "jd.txt").strip() or "jd.txt"
    if not _allowed_jd_filename(safe_name):
        raise HTTPException(400, "Unsupported file type. Allowed: PDF, TXT, MD, DOCX.")

    try:
        raw_text, meta = extract_text_with_metadata(blob, safe_name)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(400, "Could not extract text from file") from exc

    text = _normalize_jd_text(raw_text)
    if not text:
        raise HTTPException(400, "Could not extract text from file")

    warnings: List[str] = []
    if isinstance(meta, dict):
        for item in meta.get("warnings") or []:
            if isinstance(item, str) and item.strip():
                warnings.append(item.strip())

    return text, warnings
