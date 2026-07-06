"""Canonical ResumeProfile normalization for vault persistence and consumers."""
from __future__ import annotations

from typing import Any, Dict, List

from models.resume import ResumeProfile
from services.resume.scorecard_service import normalize_resume_for_scorecard


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        raw = value.get("raw")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return str(value).strip()


def _normalize_work_experience_entries(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    entries = raw.get("work_experience")
    if not isinstance(entries, list):
        entries = raw.get("workExperience")
    if not isinstance(entries, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for item in entries:
        if not isinstance(item, dict):
            continue
        responsibilities = item.get("responsibilities")
        if not isinstance(responsibilities, list):
            responsibilities = []
        responsibilities = [str(r).strip() for r in responsibilities if str(r).strip()]
        description = _safe_str(item.get("jobDescription"))
        if description and not responsibilities:
            responsibilities = [description]
        impact = item.get("impact")
        if not isinstance(impact, list):
            impact = []
        impact = [str(i).strip() for i in impact if str(i).strip()]
        tech_stack = item.get("tech_stack") or item.get("technologies") or []
        if not isinstance(tech_stack, list):
            tech_stack = []
        tech_stack = [str(t).strip() for t in tech_stack if str(t).strip()]

        normalized.append(
            {
                "title": _safe_str(item.get("title") or item.get("jobTitle")) or None,
                "company": _safe_str(item.get("company") or item.get("organization")) or None,
                "location": _safe_str(item.get("location")) or None,
                "start_date": _safe_str(item.get("start_date") or item.get("dates")) or None,
                "end_date": _safe_str(item.get("end_date")) or None,
                "employment_type": _safe_str(item.get("employment_type")) or None,
                "responsibilities": responsibilities,
                "tech_stack": tech_stack,
                "impact": impact,
            }
        )
    return normalized


def _coerce_profile_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Map legacy field aliases into ResumeProfile-compatible dict."""
    data = dict(raw) if isinstance(raw, dict) else {}
    if not data:
        return {}

    name = data.get("name")
    if isinstance(name, dict):
        data["name"] = _safe_str(name) or None
    elif name is not None:
        data["name"] = _safe_str(name) or None

    data["work_experience"] = _normalize_work_experience_entries(data)
    data.pop("workExperience", None)

    if "headline" in data and not data.get("summary"):
        headline = _safe_str(data.get("headline"))
        if headline:
            data["summary"] = headline

    return data


def normalize_profile_snapshot(raw: Dict[str, Any]) -> ResumeProfile:
    """Validate and return canonical ResumeProfile from arbitrary stored dict."""
    coerced = _coerce_profile_dict(raw)
    return ResumeProfile.model_validate(coerced)


def profile_snapshot_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize to canonical dict for Firestore persistence."""
    return normalize_profile_snapshot(raw).model_dump()


def profile_content_hash(raw: Dict[str, Any]) -> str:
    """Stable hash of canonical profile content for JD Fit cache keys."""
    import hashlib

    canonical = normalize_profile_snapshot(raw).model_dump_json()
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()[:16]


def normalized_profile_for_scoring(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Scorecard/JD compact input with alias fields already normalized."""
    return normalize_resume_for_scorecard(profile_snapshot_dict(raw))
