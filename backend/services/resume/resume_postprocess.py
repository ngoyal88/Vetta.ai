"""Deterministic cleanup for parsed resume profiles (education, achievements, links)."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from models.resume import AchievementItem, ResumeProfile

CGPA_INLINE_RE = re.compile(
    r",?\s*((?:cgpa|gpa)\s*[:\-]?\s*[\d\.]+(?:/\d+(?:\.\d+)?)?)",
    re.I,
)


def parse_degree_field_minor(line: str) -> tuple[str, str, str]:
    text = line.strip()
    minor = ""
    minor_match = re.search(r",?\s*minor(?:\s+in)?\s+(.+)$", text, re.I)
    if minor_match:
        minor = minor_match.group(1).strip(" .,-")
        text = text[: minor_match.start()].strip()

    field = ""
    in_match = re.search(r"\s+in\s+(.+)$", text, re.I)
    if in_match:
        field = in_match.group(1).strip(" .,-")
        text = text[: in_match.start()].strip()

    degree_match = re.search(
        r"^(bachelor(?:'s)?(?:\s+of\s+engineering|\s+of\s+technology|\s+of\s+science)?|"
        r"master(?:'s)?(?:\s+of\s+\w+(?:\s+&\s+\w+)?)?|"
        r"ph\.?d\.?|b\.?e\.?|b\.?tech\.?|m\.?tech\.?)$",
        text,
        re.I,
    )
    degree = degree_match.group(0).strip() if degree_match else text
    return degree, field, minor


def extract_cgpa_from_text(text: str) -> tuple[str, str]:
    if not text:
        return "", ""
    match = CGPA_INLINE_RE.search(text)
    if not match:
        return text.strip(), ""
    cgpa = match.group(1).strip()
    if not re.match(r"^(cgpa|gpa)\b", cgpa, re.I):
        cgpa = f"CGPA: {cgpa}"
    cleaned = CGPA_INLINE_RE.sub("", text).strip(" ,.-")
    return cleaned, cgpa


def normalize_education_record(record: Dict[str, Any]) -> Dict[str, Any]:
    degree = str(record.get("degree") or "").strip()
    field = str(record.get("field") or "").strip()
    minor = str(record.get("minor") or "").strip()

    if degree and (" in " in degree.lower() or not field):
        parsed_degree, parsed_field, parsed_minor = parse_degree_field_minor(degree)
        degree = parsed_degree or degree
        field = field or parsed_field
        minor = minor or parsed_minor

    if field and degree.lower().endswith(field.lower()):
        degree = degree[: -len(field)].strip(" ,.-")
        degree = re.sub(r"\s+in\s*$", "", degree, flags=re.I).strip()

    extracted_cgpa = ""
    education_text = {"degree": degree, "field": field, "minor": minor}
    for key in ("degree", "field", "minor"):
        cleaned, found = extract_cgpa_from_text(education_text[key])
        education_text[key] = cleaned
        if found and not extracted_cgpa:
            extracted_cgpa = found
    degree = education_text["degree"]
    field = education_text["field"]
    minor = education_text["minor"]

    dates = str(record.get("dates") or "").strip()
    start = str(record.get("start_date") or "").strip()
    end = str(record.get("end_date") or "").strip()
    if start and end:
        dates = f"{start} - {end}"
    elif not dates and (start or end):
        dates = " - ".join(part for part in (start, end) if part)

    location = str(record.get("location") or "").strip()
    if location and dates:
        location = re.sub(
            r"\b(19|20)\d{2}\s*[-–]\s*((19|20)\d{2}|present|current)\b",
            "",
            location,
            flags=re.I,
        ).strip(" ,.-")
        location = re.sub(r"\b(19|20)\d{2}\b", "", location).strip(" ,.-")
    if location and location.lower() == dates.lower():
        location = ""

    cgpa = str(record.get("cgpa") or "").strip() or extracted_cgpa
    if cgpa and not re.match(r"^(cgpa|gpa)\b", cgpa, re.I):
        cgpa = f"CGPA: {cgpa}"

    return {
        **record,
        "degree": degree,
        "field": field,
        "minor": minor,
        "institution": str(record.get("institution") or "").strip(),
        "dates": dates,
        "cgpa": cgpa,
        "location": location,
    }


def merge_education_entries(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    for item in (normalize_education_record(entry) for entry in items):
        has_degree = bool(item.get("degree"))
        has_field = bool(item.get("field"))
        has_institution = bool(item.get("institution"))
        if merged:
            prev = merged[-1]
            prev_has_degree = bool(prev.get("degree") or prev.get("field"))
            prev_has_institution = bool(prev.get("institution"))
            if has_institution and not has_degree and not has_field and prev_has_degree and not prev_has_institution:
                prev.update({key: value for key, value in item.items() if value and not prev.get(key)})
                continue
            if (has_degree or has_field) and not has_institution and prev_has_institution and not prev_has_degree:
                prev.update({key: value for key, value in item.items() if value and not prev.get(key)})
                continue
        merged.append(item)
    return merged


def _normalize_achievement_text(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "").lower().strip())


def _achievement_blob(item: AchievementItem) -> str:
    return _normalize_achievement_text(f"{item.title} {item.description or ''}")


def _is_link_dump_achievement(item: AchievementItem) -> bool:
    title = _normalize_achievement_text(item.title)
    if title.startswith("[link") or title in {"links", "link"}:
        return True
    return len(re.findall(r"https?://", _achievement_blob(item))) >= 2


def _is_duplicate_achievement(left: AchievementItem, right: AchievementItem) -> bool:
    left_blob = _achievement_blob(left)
    right_blob = _achievement_blob(right)
    if not left_blob or not right_blob:
        return False
    if left_blob == right_blob or left_blob in right_blob or right_blob in left_blob:
        return True
    left_title = _normalize_achievement_text(left.title)
    right_title = _normalize_achievement_text(right.title)
    if left_title and right_title and (left_title in right_title or right_title in left_title):
        return min(len(left_title), len(right_title)) >= 12
    return False


def _achievement_quality(item: AchievementItem) -> int:
    score = 0
    if item.description:
        score += 2
    if item.date:
        score += 1
    if len(item.title or "") < 120:
        score += 1
    return score


def dedupe_achievements(items: List[AchievementItem]) -> List[AchievementItem]:
    kept: List[AchievementItem] = []
    for candidate in items:
        if _is_link_dump_achievement(candidate):
            continue
        duplicate_index: Optional[int] = None
        for index, existing in enumerate(kept):
            if _is_duplicate_achievement(existing, candidate):
                duplicate_index = index
                break
        if duplicate_index is None:
            kept.append(candidate)
        elif _achievement_quality(candidate) > _achievement_quality(kept[duplicate_index]):
            kept[duplicate_index] = candidate
    return kept


def _looks_like_url(value: str) -> bool:
    text = value.strip().lower()
    return text.startswith(("http://", "https://", "www.")) or "mailto:" in text or ".com/" in text


def _canonical_link(value: str) -> str:
    return value.strip().lower().rstrip("/").replace("https://", "").replace("http://", "").replace("www.", "")


def sanitize_profile_links_and_skills(profile: ResumeProfile) -> None:
    links = profile.contact.links
    canonical: set[str] = set()
    for value in (links.github, links.linkedin, links.portfolio):
        if value:
            canonical.add(_canonical_link(value))

    cleaned_other: List[str] = []
    for value in links.other or []:
        text = (value or "").strip()
        if not text:
            continue
        lower = text.lower()
        if "github.com" in lower and not links.github:
            links.github = text
            canonical.add(_canonical_link(text))
            continue
        if "linkedin.com" in lower and not links.linkedin:
            links.linkedin = text
            canonical.add(_canonical_link(text))
            continue
        link_key = _canonical_link(text)
        if link_key in canonical:
            continue
        canonical.add(link_key)
        cleaned_other.append(text)
    links.other = cleaned_other

    skill_categories = (
        profile.skills.languages,
        profile.skills.frameworks,
        profile.skills.databases,
        profile.skills.cloud,
        profile.skills.tools,
        profile.skills.ml_ai,
        profile.skills.other,
    )
    for category in skill_categories:
        category[:] = [item for item in category if item and not _looks_like_url(item)]
