"""Hash helpers for JD Fit cache keys and deduplication."""

from __future__ import annotations

import hashlib
import re
from typing import Optional

from services.jd_fit.jd_fit_weights import SCHEMA_VERSION


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def normalize_role(role: str) -> str:
    return normalize_ws(role).lower()


def jd_hash(job_description: str) -> str:
    text = normalize_ws((job_description or "").lower())
    if not text:
        return "none"
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


def inputs_hash(
    uid: str,
    role: str,
    job_description: str,
    resume_id: Optional[str],
    version_id: Optional[str],
    schema_version: int = SCHEMA_VERSION,
    target_company: Optional[str] = None,
    profile_revision: Optional[str] = None,
) -> str:
    payload = (
        f"{uid}|{normalize_role(role)}|{jd_hash(job_description)}|"
        f"{resume_id or ''}|{version_id or ''}|{normalize_ws((target_company or '').lower())}|"
        f"{profile_revision or ''}|{schema_version}"
    )
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:16]
