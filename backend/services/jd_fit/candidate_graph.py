"""Build in-memory Candidate Intelligence Graph from resume + VPM."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Set

from services.profile_memory.umbrella_terms import normalize_text
from services.resume.profile_normalizer import profile_snapshot_dict
from services.resume.skills_normalizer import flatten_skills_from_profile, normalize_skills_input

SkillDepth = Literal["listed", "evidenced", "production"]
SkillSource = Literal["resume", "vpm"]


@dataclass
class SkillNode:
    skill: str
    source: SkillSource
    depth: SkillDepth
    evidence_quote: Optional[str] = None
    confidence: float = 0.5


@dataclass
class CandidateIntelligenceGraph:
    uid: str
    skills_resume: Dict[str, SkillNode] = field(default_factory=dict)
    skills_vpm: Dict[str, SkillNode] = field(default_factory=dict)
    skills_merged: Dict[str, SkillNode] = field(default_factory=dict)
    work_experience: List[Dict[str, Any]] = field(default_factory=list)
    seniority_level: str = "unknown"
    years_experience: Optional[float] = None
    title_tokens: List[str] = field(default_factory=list)
    has_tenure_gaps: bool = False
    has_quantified_bullets: bool = False
    resume_corpus: str = ""
    education: List[Dict[str, Any]] = field(default_factory=list)
    profile_location: Optional[str] = None
    experience_locations: List[str] = field(default_factory=list)
    project_summaries: List[str] = field(default_factory=list)


def _collect_resume_skills(profile: Dict[str, Any]) -> Dict[str, Set[str]]:
    """Map normalized skill key -> placement tags (listed, evidenced)."""
    placements: Dict[str, Set[str]] = {}

    def add(skill: str, tag: str) -> None:
        key = normalize_text(skill)
        if not key or len(key) < 2:
            return
        placements.setdefault(key, set()).add(tag)

    for group in normalize_skills_input(profile.get("skills")):
        for item in group.items:
            add(item, "listed")

    for exp in profile.get("work_experience") or []:
        if not isinstance(exp, dict):
            continue
        for stack_item in exp.get("tech_stack") or []:
            if isinstance(stack_item, str):
                add(stack_item, "evidenced")
        for bullet in (exp.get("responsibilities") or []) + (exp.get("impact") or []):
            if isinstance(bullet, str):
                for token in re.findall(r"[A-Za-z][A-Za-z0-9+#./-]{1,30}", bullet):
                    if len(token) >= 3:
                        add(token, "evidenced")

    for project in profile.get("projects") or []:
        if not isinstance(project, dict):
            continue
        for tech in project.get("technologies") or project.get("tech_stack") or []:
            if isinstance(tech, str):
                add(tech, "evidenced")

    return placements


def _flatten_corpus(profile: Dict[str, Any]) -> str:
    parts: List[str] = []
    for key in ("summary", "headline", "raw_text"):
        val = profile.get(key)
        if isinstance(val, str) and val.strip():
            parts.append(val.strip())

    for exp in profile.get("work_experience") or []:
        if not isinstance(exp, dict):
            continue
        for field_name in ("title", "company", "location"):
            val = exp.get(field_name)
            if isinstance(val, str):
                parts.append(val)
        for bullet in (exp.get("responsibilities") or []) + (exp.get("impact") or []):
            if isinstance(bullet, str):
                parts.append(bullet)

    skills = profile.get("skills")
    for group in normalize_skills_input(skills):
        parts.extend(group.items)

    for edu in profile.get("education") or []:
        if isinstance(edu, dict):
            parts.extend(str(v) for v in edu.values() if isinstance(v, str) and v.strip())

    for project in profile.get("projects") or []:
        if isinstance(project, dict):
            for field_name in ("name", "title", "description", "summary"):
                val = project.get(field_name)
                if isinstance(val, str) and val.strip():
                    parts.append(val)

    return " ".join(parts).lower()


def _parse_year_month(value: Optional[str]) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    text = value.strip().lower()
    if text in ("present", "current", "now"):
        return datetime.utcnow()
    month_map = {
        "jan": 1,
        "january": 1,
        "feb": 2,
        "february": 2,
        "mar": 3,
        "march": 3,
        "apr": 4,
        "april": 4,
        "may": 5,
        "jun": 6,
        "june": 6,
        "jul": 7,
        "july": 7,
        "aug": 8,
        "august": 8,
        "sep": 9,
        "sept": 9,
        "september": 9,
        "oct": 10,
        "october": 10,
        "nov": 11,
        "november": 11,
        "dec": 12,
        "december": 12,
    }
    month_match = re.search(
        r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|"
        r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b",
        text,
    )
    match = re.search(r"(20\d{2}|19\d{2})", text)
    if match:
        month = month_map.get(month_match.group(1), 6) if month_match else 6
        return datetime(int(match.group(1)), month, 1)
    return None


def _employment_intervals(work_experience: List[Dict[str, Any]]) -> List[tuple[datetime, datetime]]:
    ranges: List[tuple[datetime, datetime]] = []
    for exp in work_experience:
        if not isinstance(exp, dict):
            continue
        start = _parse_year_month(exp.get("start_date"))
        end = _parse_year_month(exp.get("end_date")) or datetime.utcnow()
        if start and end and end >= start:
            ranges.append((start, end))
    return ranges


def _merge_intervals(intervals: List[tuple[datetime, datetime]]) -> List[tuple[datetime, datetime]]:
    if not intervals:
        return []
    sorted_ranges = sorted(intervals, key=lambda r: r[0])
    merged: List[tuple[datetime, datetime]] = [sorted_ranges[0]]
    for start, end in sorted_ranges[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _years_from_work_experience(work_experience: List[Dict[str, Any]]) -> Optional[float]:
    """ponytail: union of employment spans; concurrent roles not double-counted; no FTE weighting."""
    intervals = _merge_intervals(_employment_intervals(work_experience))
    if not intervals:
        return None
    total_days = sum((end - start).days for start, end in intervals)
    return round(total_days / 365.25, 1)


def _detect_tenure_gaps(work_experience: List[Dict[str, Any]]) -> bool:
    ranges = _employment_intervals(work_experience)
    if len(ranges) < 2:
        return False
    ranges.sort(key=lambda r: r[0])
    for idx in range(len(ranges) - 1):
        gap_days = (ranges[idx + 1][0] - ranges[idx][1]).days
        if gap_days > 183:
            return True
    return False


def _has_quantified_bullets(work_experience: List[Dict[str, Any]]) -> bool:
    for exp in work_experience[:2]:
        if not isinstance(exp, dict):
            continue
        for bullet in (exp.get("responsibilities") or []) + (exp.get("impact") or []):
            if isinstance(bullet, str) and re.search(r"\d", bullet):
                return True
    return False


def _title_tokens(work_experience: List[Dict[str, Any]]) -> List[str]:
    tokens: List[str] = []
    for exp in work_experience[:2]:
        if not isinstance(exp, dict):
            continue
        title = exp.get("title")
        if isinstance(title, str) and title.strip():
            tokens.extend(re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", title.lower()))
    return list(dict.fromkeys(tokens))[:20]


def _profile_location(profile: Dict[str, Any]) -> Optional[str]:
    for key in ("location", "current_location", "city"):
        val = profile.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def _experience_locations(work_experience: List[Dict[str, Any]]) -> List[str]:
    locations: List[str] = []
    for exp in work_experience:
        location = exp.get("location") if isinstance(exp, dict) else None
        if isinstance(location, str) and location.strip():
            locations.append(location.strip())
    return list(dict.fromkeys(locations))[:8]


def _project_summaries(profile: Dict[str, Any]) -> List[str]:
    summaries: List[str] = []
    for project in profile.get("projects") or []:
        if not isinstance(project, dict):
            continue
        bits = [
            project.get("name") or project.get("title"),
            project.get("description") or project.get("summary"),
        ]
        text = ": ".join(str(bit).strip() for bit in bits if bit)
        if text:
            summaries.append(text[:260])
    return summaries[:8]


def _vpm_claims(profile_memory: Dict[str, Any]) -> List[Dict[str, Any]]:
    claims: List[Dict[str, Any]] = []
    for bucket in ("technical", "experience", "behavioral"):
        for entry in profile_memory.get(bucket) or []:
            if isinstance(entry, dict):
                claims.append(entry)
    return claims


def build_candidate_graph(
    uid: str,
    profile: Dict[str, Any],
    profile_memory: Dict[str, Any],
) -> CandidateIntelligenceGraph:
    canonical = profile_snapshot_dict(profile) if isinstance(profile, dict) else {}
    work_experience = [
        exp for exp in (canonical.get("work_experience") or []) if isinstance(exp, dict)
    ]
    placements = _collect_resume_skills(canonical)
    skills_resume: Dict[str, SkillNode] = {}

    for key, tags in placements.items():
        depth: SkillDepth = "evidenced" if "evidenced" in tags else "listed"
        display = key
        for orig in _all_skill_labels(canonical):
            if normalize_text(orig) == key:
                display = orig
                break
        skills_resume[key] = SkillNode(
            skill=display,
            source="resume",
            depth=depth,
            confidence=0.8 if depth == "evidenced" else 0.5,
        )

    skills_vpm: Dict[str, SkillNode] = {}
    for claim in _vpm_claims(profile_memory):
        text = str(claim.get("claim_text") or claim.get("normalized_key") or "").strip()
        if not text:
            continue
        key = normalize_text(str(claim.get("normalized_key") or text))
        if not key:
            continue
        skills_vpm[key] = SkillNode(
            skill=text[:120],
            source="vpm",
            depth="production",
            evidence_quote=str(claim.get("evidence_quote") or "")[:300] or None,
            confidence=float(claim.get("confidence") or 0.85),
        )

    skills_merged = dict(skills_resume)
    for key, node in skills_vpm.items():
        skills_merged[key] = node

    seniority = str(canonical.get("seniority_level") or "unknown").lower()
    years_raw = canonical.get("years_experience")
    years: Optional[float] = None
    if isinstance(years_raw, (int, float)) and float(years_raw) >= 0:
        years = float(years_raw)
    if years is None:
        years = _years_from_work_experience(work_experience)

    return CandidateIntelligenceGraph(
        uid=uid,
        skills_resume=skills_resume,
        skills_vpm=skills_vpm,
        skills_merged=skills_merged,
        work_experience=work_experience,
        seniority_level=seniority,
        years_experience=years,
        title_tokens=_title_tokens(work_experience),
        has_tenure_gaps=_detect_tenure_gaps(work_experience),
        has_quantified_bullets=_has_quantified_bullets(work_experience),
        resume_corpus=_flatten_corpus(canonical),
        education=[edu for edu in (canonical.get("education") or []) if isinstance(edu, dict)],
        profile_location=_profile_location(canonical),
        experience_locations=_experience_locations(work_experience),
        project_summaries=_project_summaries(canonical),
    )


def _all_skill_labels(profile: Dict[str, Any]) -> List[str]:
    return flatten_skills_from_profile(profile)
