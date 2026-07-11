from __future__ import annotations

import re

_RESUME_DRAFT_NAME_RE = re.compile(r"^Resume\((\d+)\)$", re.IGNORECASE)


def next_resume_draft_name(existing_names: list[str]) -> str:
    used_numbers: set[int] = set()
    for raw in existing_names:
        name = (raw or "").strip()
        if not name:
            continue
        match = _RESUME_DRAFT_NAME_RE.match(name)
        if match:
            used_numbers.add(int(match.group(1)))

    number = 1
    while number in used_numbers:
        number += 1
    return f"Resume({number})"
