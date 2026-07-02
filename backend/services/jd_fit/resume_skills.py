"""Shared resume skill flattening for JD extraction and fit alignment."""

from __future__ import annotations

from typing import Any, Dict, List


def flatten_resume_skills(profile: Dict[str, Any] | None) -> List[str]:
    if not isinstance(profile, dict):
        return []
    skills: List[str] = []
    raw = profile.get("skills")
    if isinstance(raw, dict):
        for key in ("languages", "frameworks", "databases", "cloud", "tools", "ml_ai", "other"):
            for item in raw.get(key) or []:
                if isinstance(item, str) and item.strip():
                    skills.append(item.strip())
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, str) and item.strip():
                skills.append(item.strip())
            elif isinstance(item, dict) and isinstance(item.get("name"), str):
                skills.append(item["name"].strip())
    return list(dict.fromkeys(skills))
