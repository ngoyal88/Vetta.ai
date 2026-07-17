"""Contact URL validators for resume models — kept out of models/ import graph."""
from __future__ import annotations

from typing import Any, Optional

from services.resume.contact_link_utils import (
    is_contact_other_candidate,
    is_plausible_resume_url,
    normalize_resume_url,
)


def sanitize_optional_contact_url(value: Any, *, other: bool = False) -> Optional[str]:
    if value is None:
        return None
    normalized = normalize_resume_url(str(value))
    if not normalized:
        return None
    if other:
        return normalized if is_contact_other_candidate(normalized) else None
    return normalized if is_plausible_resume_url(normalized) else None
