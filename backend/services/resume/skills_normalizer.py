"""Normalize resume skill groups for ResumeProfile."""

from __future__ import annotations

from typing import Any, Dict, List

from models.resume import SkillGroup


def _clean_items(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    cleaned: List[str] = []
    for value in values:
        if isinstance(value, str):
            text = value.strip()
            if text:
                cleaned.append(text)
    return list(dict.fromkeys(cleaned))


def normalize_skills_input(raw: Any) -> List[SkillGroup]:
    if not isinstance(raw, list):
        return []

    groups: List[SkillGroup] = []
    for entry in raw:
        if isinstance(entry, SkillGroup):
            label = (entry.label or "").strip()
            items = _clean_items(entry.items)
            if label or items:
                groups.append(SkillGroup(label=label, items=items))
            continue
        if isinstance(entry, dict):
            label = str(entry.get("label") or "").strip()
            items = _clean_items(entry.get("items"))
            if label or items:
                groups.append(SkillGroup(label=label, items=items))
    return groups


def flatten_skill_groups(groups: List[SkillGroup] | None) -> List[str]:
    if not groups:
        return []
    flattened: List[str] = []
    for group in groups:
        for item in group.items:
            text = (item or "").strip()
            if text:
                flattened.append(text)
    return list(dict.fromkeys(flattened))


def flatten_skills_from_profile(profile: Dict[str, Any] | None) -> List[str]:
    if not isinstance(profile, dict):
        return []
    return flatten_skill_groups(normalize_skills_input(profile.get("skills")))
