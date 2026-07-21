import re
import json
from datetime import datetime, timezone
from io import BytesIO
from typing import Dict, List, Any, Optional, Tuple

from PyPDF2 import PdfReader
import docx
from docx.oxml.ns import qn

try:
    import fitz  # PyMuPDF
except Exception:  # pragma: no cover - exercised only when dependency is unavailable
    fitz = None

from firebase_config import db
from models.resume import (
    AchievementItem,
    CustomSectionItem,
    EducationRecord,
    ParsedResumeResponse,
    ProjectItem,
    ResumeProfile,
    SkillGroup,
)
from services.platform.llm import get_platform_llm
from services.resume.contact_link_utils import unique_plausible_urls
from services.resume.resume_postprocess import (
    dedupe_achievements,
    dedupe_work_experience,
    normalize_education_record,
    sanitize_profile_links_and_skills,
)

_RESUME_INPUT_MAX_CHARS = 6000
_GAP_SPACE_THRESHOLD = 2.0
_LONG_LINE_SPLIT_THRESHOLD = 120

_RESUME_PROFILE_SCHEMA = (
    '  "profile": {\n'
    '    "name": string or null,\n'
    '    "contact": {\n'
    '      "email": string or null,\n'
    '      "phone": string or null,\n'
    '      "location": string or null,\n'
    '      "links": {\n'
    '        "github": string or null,\n'
    '        "linkedin": string or null,\n'
    '        "portfolio": string or null,\n'
    '        "other": string array\n'
    "      }\n"
    "    },\n"
    '    "summary": string or null,\n'
    '    "years_experience": number or null,\n'
    '    "seniority_level": "junior" | "mid" | "senior" | "lead" | "principal" | "unknown",\n'
    '    "skills": [{ "label": string, "items": string array }],\n'
    '    "education": [{\n'
    '      "degree": string or null, "field": string or null, "minor": string or null,\n'
    '      "institution": string or null, "start_date": string or null, "end_date": string or null,\n'
    '      "cgpa": string or null, "location": string or null\n'
    "    }],\n"
    '    "work_experience": [{\n'
    '      "title": string or null, "company": string or null, "location": string or null,\n'
    '      "start_date": string or null, "end_date": string or null,\n'
    '      "employment_type": "intern" | "full_time" | "part_time" | "contract" | "freelance" | "co_op" | "temporary" | "volunteer" | "other" | null,\n'
    '      "responsibilities": string array, "tech_stack": string array, "impact": string array\n'
    "    }],\n"
    '    "projects": [{\n'
    '      "name": string or null,\n'
    '      "description": string or null — newline-separated bullet points for this project,\n'
    '      "tech_stack": string array — technology/tool names only (not bullet sentences),\n'
    '      "role": string or null, "scale": string or null,\n'
    '      "start_date": string or null, "end_date": string or null, "link": string or null\n'
    "    }],\n"
    '    "achievements": [{ "title": string, "description": string or null, "date": string or null }],\n'
    '    "publications": [{ "title": string, "venue": string or null, "year": string or null, "link": string or null }],\n'
    '    "custom_sections": [{ "title": string, "lines": string array }],\n'
    '    "weak_areas": string array,\n'
    '    "raw_text": string or null\n'
    "  }"
)

_RESUME_PARSER_SYSTEM_PROMPT = (
    "You extract structured data from a resume into JSON. Return ONLY valid JSON — no markdown, no commentary.\n\n"
    "{\n"
    f"{_RESUME_PROFILE_SCHEMA},\n"
    '  "meta": { "uid": string, "source": string, "model": string, "parsed_at": string, "version": string }\n'
    "}\n\n"
    "CONTRACT (all rules are mandatory):\n"
    "1. GROUNDED — Include only facts explicitly present in the source. "
    "Do not invent skills, tools, companies, dates, or metrics.\n"
    "2. VERBATIM — Copy the candidate's exact wording for summary, bullets, descriptions, and achievements. "
    "One resume bullet or sentence = one array element. Never shorten, merge, or paraphrase.\n"
    "3. SECTION-CORRECT — Place each item in the field that matches its resume section header:\n"
    "   • work_experience → jobs, internships, simulations (Experience / Work / Employment / Simulations)\n"
    "   • projects → builds, products, portfolio items (Projects / Product / Portfolio / Featured)\n"
    "   • achievements → awards, certifications, honors, competitive programming (Achievements / Certifications / Honors)\n"
    "   • Never put the same item in both work_experience and projects.\n"
    "4. NUMBERED — Input lines are prefixed [line NNNN]. Copy bullet text exactly from those lines. "
    "One bullet = one array element. Never merge multiple numbered lines into one field.\n"
    "5. UNKNOWN_SECTIONS — Non-standard headers (e.g. Experience & Simulations, Achievements & Coursework, "
    "Achievements & Certifications, Soft Skills) → map achievement/certification/honor lines to achievements[]; "
    "map coursework/soft-skill lines to custom_sections; never drop recognizable section content.\n"
    "6. SKILL_SUBGROUPS — Preserve sub-labels (Languages, Frontend, Backend, Database, Tools, Concepts, etc.) "
    "as separate skills[].label groups with their items.\n"
    "7. CONTACT — Primary email in contact.email; profile URLs only in contact.links "
    "(linkedin, github profile root, portfolio, leetcode). Additional emails in contact.links.other.\n"
    "8. PROJECT_BULLETS — Put each project bullet sentence in projects[].description (join with newlines). "
    "projects[].tech_stack = short tool names only. Repository / Live Demo / demo-site URLs go in projects[].link — "
    "never in contact.links.\n"
    "9. PDF_HYPERLINKS — When an EXTRACTED PDF HYPERLINKS block is provided, those URIs are authoritative. "
    "Copy them exactly into contact.links or projects[].link. Never invent URLs from visible link labels.\n\n"
    "Defaults: employment_type and impact[] only when clearly stated; otherwise null and []. "
    "weak_areas: []. custom_sections: [] when nothing extra."
)

_INLINE_BULLET_SPLIT_RE = re.compile(
    r"\s+[–—]\s+(?=(?:Implemented|Designed|Built|Engineered|Architected|Developed|"
    r"Completed|Produced|Translated|Analyzed|Demonstrated|Integrated|Developed)\b)",
    re.I,
)
_PROJECT_TITLE_SPLIT_RE = re.compile(r"(?<=\S)\s+(?=[A-Z][A-Za-z0-9]{2,}\s+[–—\-]\s+)")
_LINK_FOOTER_RE = re.compile(r"\n\n\[Links:\s*.+\]\s*$", re.S | re.I)
_ACHIEVEMENT_SECTION_TITLE_RE = re.compile(
    r"\b(achievement|achievements|certification|certifications|honors?|awards?)\b",
    re.I,
)
_PROJECT_BULLET_IN_TECH_RE = re.compile(
    r"^(?:implemented|designed|built|engineered|architected|developed|completed|integrated|"
    r"produced|translated|analyzed|demonstrated)\b",
    re.I,
)
_SECTION_ALIASES = {
    "summary": {"summary", "profile", "professional summary", "objective"},
    "skills": {"skills", "technical skills", "core skills", "technologies"},
    "work": {"work experience", "experience", "employment", "professional experience", "internships"},
    "projects": {"projects", "featured product & design projects", "featured projects", "product projects", "portfolio"},
    "education": {"education", "academic background"},
    "achievements": {"achievements", "certifications", "honors", "awards", "achievements & certifications"},
}
_DATE_LINE_RE = re.compile(r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|present)\b", re.I)
_RESPONSIBILITY_START_RE = re.compile(
    r"^(?:[-*•]\s*)?(?:built|implemented|designed|developed|engineered|architected|led|created|"
    r"managed|integrated|optimized|reduced|improved|achieved|focused|database|end-to-end)\b",
    re.I,
)
_TITLE_WORD_RE = re.compile(r"\b(?:engineer|developer|intern|researcher|manager|lead|architect|analyst|consultant)s?\b", re.I)
_KNOWN_TECH_RE = re.compile(
    r"\b(FastAPI|Redis|PostgreSQL|MongoDB|Node\.js|Express|React|Tailwind|TensorFlow|Keras|Python|"
    r"JavaScript|TypeScript|Docker|Kubernetes|Kafka|Gemini)\b",
    re.I,
)


def _normalize_grounding_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _grounding_variants(value: str) -> List[str]:
    normalized = _normalize_grounding_key(value)
    if not normalized:
        return []
    variants = {normalized}
    variants.add(re.sub(r"(?<=[a-z])(?=\d)", " ", normalized))
    variants.add(re.sub(r"(?<=\d)(?=\d)", " ", normalized))
    variants.add(re.sub(r"(?<=\d)(?=[a-z])", " ", normalized))
    return [variant for variant in variants if variant]


def _is_grounded_value(value: Optional[str], text_norm: str) -> bool:
    if not value:
        return False
    collapsed_text = _normalize_grounding_key(text_norm)
    for variant in _grounding_variants(value):
        if variant in collapsed_text:
            return True
    return False


def _strip_link_footer(text: str) -> str:
    return _LINK_FOOTER_RE.sub("", text).strip()


def _norm_match_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _section_key(line: str) -> Optional[str]:
    normalized = _norm_match_key(line)
    for key, aliases in _SECTION_ALIASES.items():
        if normalized in {_norm_match_key(alias) for alias in aliases}:
            return key
    return None


def split_sections(text: str) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = {}
    current = "summary"
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        section = _section_key(line)
        if section:
            current = section
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return sections


def _clean_bullet(line: str) -> str:
    return re.sub(r"^\s*[-*•]\s*", "", str(line or "").strip())


def extract_summary(sections: Dict[str, List[str]]) -> Optional[str]:
    summary = " ".join(_clean_bullet(line) for line in sections.get("summary", []) if line.strip()).strip()
    return summary or None


def extract_education(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    lines = [_clean_bullet(line) for line in sections.get("education", []) if line.strip()]
    if not lines:
        return []

    record: Dict[str, Any] = {
        "institution": None,
        "degree": None,
        "field": None,
        "dates": None,
        "cgpa": None,
        "location": None,
    }
    institution_line = lines[0]
    if "," in institution_line:
        institution, location = [part.strip() for part in institution_line.split(",", 1)]
        record["institution"] = institution
        record["location"] = location
    else:
        record["institution"] = institution_line

    for line in lines[1:]:
        if re.search(r"\b(?:cgpa|gpa)\b", line, re.I):
            record["cgpa"] = line
            continue
        if re.search(r"\b\d{4}\b", line):
            record["dates"] = line
            continue
        degree_match = re.match(r"(.+?)\s+in\s+(.+)", line, re.I)
        if degree_match:
            record["degree"] = degree_match.group(1).strip()
            record["field"] = degree_match.group(2).strip()
        elif record["degree"] is None:
            record["degree"] = line

    return [record]


def extract_achievements(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    achievements: List[Dict[str, Any]] = []
    for line in sections.get("achievements", []):
        text = _clean_bullet(line)
        if not text:
            continue
        title, description = text, None
        if ":" in text:
            title, description = [part.strip() for part in text.split(":", 1)]
        date_match = re.search(r"\b(20\d{2}|19\d{2})\b", text)
        achievements.append(
            {
                "title": title,
                "description": description,
                "date": date_match.group(1) if date_match else None,
            }
        )
    return achievements


def _extract_known_tech(text: str) -> List[str]:
    seen: set[str] = set()
    tools: List[str] = []
    for match in _KNOWN_TECH_RE.finditer(text or ""):
        tool = match.group(1)
        key = tool.lower()
        if key in seen:
            continue
        seen.add(key)
        tools.append(tool)
    return tools


def extract_projects(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    lines = [_clean_bullet(line) for line in sections.get("projects", []) if line.strip()]
    if not lines:
        return []

    projects: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    for line in lines:
        looks_like_title = not _RESPONSIBILITY_START_RE.match(line) and (
            " - " in line or " – " in line or " — " in line or re.search(r"\(.+\)", line)
        )
        if current is None or looks_like_title:
            if current:
                projects.append(current)
            link_match = re.search(r"https?://\S+", line)
            title = re.sub(r"https?://\S+", "", line).strip(" -–—")
            current = {
                "name": re.split(r"\s[-–—]\s", title, maxsplit=1)[0].strip() or title,
                "description": "",
                "tech_stack": _extract_known_tech(line),
                "link": link_match.group(0) if link_match else None,
            }
            continue

        description = current.get("description") or ""
        current["description"] = "\n".join(part for part in [description, line] if part)
        current["tech_stack"] = list(dict.fromkeys([*current.get("tech_stack", []), *_extract_known_tech(line)]))

    if current:
        projects.append(current)
    return projects


def _is_next_work_title(lines: List[str], index: int) -> bool:
    if index + 1 >= len(lines):
        return False
    line = lines[index]
    next_line = lines[index + 1]
    if _RESPONSIBILITY_START_RE.match(line):
        return False
    return bool(_TITLE_WORD_RE.search(line)) and not _DATE_LINE_RE.search(next_line)


def extract_work_experience(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    lines = [_clean_bullet(line) for line in sections.get("work", []) if line.strip()]
    entries: List[Dict[str, Any]] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if "|" in line:
            parts = [part.strip() for part in line.split("|")]
            entry = {
                "title": parts[0] if parts else None,
                "company": parts[1] if len(parts) > 1 else None,
                "dates": parts[2] if len(parts) > 2 else None,
                "responsibilities": [],
            }
            index += 1
        else:
            if index + 1 >= len(lines):
                break
            entry = {
                "title": line,
                "company": lines[index + 1],
                "dates": None,
                "responsibilities": [],
            }
            index += 2
            if index < len(lines) and _norm_match_key(lines[index]) in {"intern", "full time", "part time", "contract"}:
                index += 1
            if index < len(lines) and _DATE_LINE_RE.search(lines[index]):
                entry["dates"] = lines[index]
                index += 1

        responsibilities: List[str] = []
        while index < len(lines):
            if _is_next_work_title(lines, index):
                break
            responsibilities.append(lines[index])
            index += 1
        entry["responsibilities"] = responsibilities
        entries.append(entry)
    return entries


def _prefer_verbatim_bullets(llm_bullets: List[str], source_bullets: List[str], work_lines: List[str]) -> List[str]:
    if not source_bullets:
        return llm_bullets
    source_blob = " ".join(_norm_match_key(line) for line in work_lines)
    if not source_blob:
        return llm_bullets
    for bullet in llm_bullets:
        if _norm_match_key(bullet) and _norm_match_key(bullet) not in source_blob:
            return source_bullets
    return source_bullets if len(" ".join(source_bullets)) > len(" ".join(llm_bullets)) else llm_bullets


def _build_pdf_links_prompt_appendix(pdf_links: List[str]) -> str:
    urls = unique_plausible_urls(pdf_links)
    if not urls:
        return ""
    return "\n".join(
        ["", "EXTRACTED PDF HYPERLINKS (clickable URIs from the PDF — use these exact URLs):"]
        + [f"- {url}" for url in urls]
    )


def _promote_achievement_custom_sections(profile: ResumeProfile) -> None:
    remaining: List[CustomSectionItem] = []
    promoted: List[AchievementItem] = []

    for section in profile.custom_sections:
        if _ACHIEVEMENT_SECTION_TITLE_RE.search(section.title):
            for line in section.lines:
                text = line.strip()
                if text:
                    promoted.append(AchievementItem(title=text, description=None, date=None))
            continue
        remaining.append(section)

    if promoted:
        profile.achievements = dedupe_achievements([*profile.achievements, *promoted])
    profile.custom_sections = remaining


def _normalize_project_records(profile: ResumeProfile) -> None:
    normalized: List[ProjectItem] = []
    for project in profile.projects:
        data = project.model_dump()
        description = str(data.get("description") or "").strip()
        tech_stack = list(data.get("tech_stack") or [])
        bullet_lines: List[str] = []
        tools: List[str] = []

        for item in tech_stack:
            text = str(item or "").strip()
            if not text:
                continue
            if len(text) > 60 or _PROJECT_BULLET_IN_TECH_RE.match(text):
                bullet_lines.append(text.lstrip("–—- ").strip())
            else:
                tools.append(text)

        if bullet_lines:
            description = "\n".join(
                part for part in [description, *bullet_lines] if part and part.strip()
            ).strip()

        data["description"] = description or None
        data["tech_stack"] = tools
        normalized.append(ProjectItem(**data))

    profile.projects = normalized


def _build_numbered_resume_prompt(raw_text: str, max_chars: int = _RESUME_INPUT_MAX_CHARS) -> str:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    numbered = [f"[line {index:04d}] {line}" for index, line in enumerate(lines, 1)]
    blob = "\n".join(numbered)
    return blob[:max_chars]


def _join_spans_with_gaps(spans: List[Dict[str, Any]]) -> str:
    ordered = sorted(spans, key=lambda span: float(span["x0"]))
    parts: List[str] = []
    prev_x1: Optional[float] = None
    for span in ordered:
        text = str(span.get("text") or "")
        if not text:
            continue
        if prev_x1 is not None and float(span["x0"]) - prev_x1 > _GAP_SPACE_THRESHOLD:
            parts.append(" ")
        parts.append(text)
        prev_x1 = float(span["x1"])
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def split_long_inline_line(line: str) -> List[str]:
    """ponytail: heuristic split for meg-lines when PDF blocks glue projects/bullets."""
    stripped = line.strip()
    if not stripped or len(stripped) <= _LONG_LINE_SPLIT_THRESHOLD:
        return [stripped] if stripped else []

    segments = _INLINE_BULLET_SPLIT_RE.split(stripped)
    if len(segments) > 1:
        result = [segments[0].strip()]
        for segment in segments[1:]:
            text = segment.strip()
            if text:
                result.append(f"– {text}")
        return [part for part in result if part]

    project_parts = _PROJECT_TITLE_SPLIT_RE.split(stripped)
    if len(project_parts) > 1:
        return [part.strip() for part in project_parts if part.strip()]

    pipe_parts = [part.strip() for part in re.split(r"\s+\|\s+", stripped) if part.strip()]
    if len(pipe_parts) > 1 and len(stripped) > _LONG_LINE_SPLIT_THRESHOLD:
        return pipe_parts

    return [stripped]


def _split_extracted_lines(lines: List[str]) -> List[str]:
    expanded: List[str] = []
    for line in lines:
        expanded.extend(split_long_inline_line(line))
    return expanded


def _rebuild_lines_from_page_words(page: Any) -> List[str]:
    data = page.get_text("dict") or {}
    raw_lines: List[Dict[str, Any]] = []

    for block in data.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans: List[Dict[str, Any]] = []
            for span in line.get("spans", []):
                text = str(span.get("text") or "")
                if not text.strip():
                    continue
                bbox = span.get("bbox") or [0, 0, 0, 0]
                spans.append(
                    {
                        "x0": float(bbox[0]),
                        "y0": float(bbox[1]),
                        "x1": float(bbox[2]),
                        "y1": float(bbox[3]),
                        "text": text,
                    }
                )
            if not spans:
                continue
            raw_lines.append(
                {
                    "x0": min(span["x0"] for span in spans),
                    "y0": min(span["y0"] for span in spans),
                    "x1": max(span["x1"] for span in spans),
                    "y1": max(span["y1"] for span in spans),
                    "text": _join_spans_with_gaps(spans),
                }
            )

    ordered_texts, _ = _order_pdf_text_blocks(raw_lines, float(page.rect.width))
    return _split_extracted_lines(ordered_texts)


def _normalize_education_profile(profile: ResumeProfile) -> None:
    profile.education = [
        EducationRecord(**normalize_education_record(record.model_dump()))
        for record in profile.education
    ]


def _merge_fallback_achievements(profile: ResumeProfile, raw_text: str) -> None:
    fallback_items = [
        AchievementItem(**item)
        for item in extract_achievements(split_sections(raw_text))
        if item.get("title")
    ]
    if fallback_items:
        profile.achievements = dedupe_achievements([*profile.achievements, *fallback_items])


def _apply_grounding_and_cleanup(
    profile: ResumeProfile,
    raw_text: str,
    pdf_links: Optional[List[str]] = None,
) -> None:
    text_norm = raw_text.lower()

    profile.skills = [
        SkillGroup(
            label=group.label,
            items=[item for item in group.items if _is_grounded_value(item, text_norm)],
        )
        for group in profile.skills
        if group.label or group.items
    ]

    profile.projects = [
        project
        for project in profile.projects
        if _is_grounded_value(project.name, text_norm)
        or (
            project.description
            and _is_grounded_value(project.description[:64], text_norm)
        )
        or any(_is_grounded_value(item, text_norm) for item in project.tech_stack)
    ]

    _normalize_project_records(profile)

    profile.work_experience = [
        work
        for work in profile.work_experience
        if _is_grounded_value(work.company, text_norm) or _is_grounded_value(work.title, text_norm)
    ]
    profile.work_experience = dedupe_work_experience(profile.work_experience)

    profile.achievements = dedupe_achievements(
        [
            achievement
            for achievement in profile.achievements
            if _is_grounded_value(achievement.title, text_norm)
            or (
                achievement.description
                and _is_grounded_value(achievement.description[:64], text_norm)
            )
        ]
    )

    profile.publications = [
        publication
        for publication in profile.publications
        if _is_grounded_value(publication.title, text_norm)
    ]

    grounded_sections: List[CustomSectionItem] = []
    for section in profile.custom_sections:
        lines = [line for line in section.lines if _is_grounded_value(line, text_norm)]
        if section.title.strip() and lines:
            grounded_sections.append(CustomSectionItem(title=section.title, lines=lines))
    profile.custom_sections = grounded_sections

    _promote_achievement_custom_sections(profile)

    sanitize_profile_links_and_skills(profile, raw_text, pdf_links)
    _normalize_education_profile(profile)

    if profile.years_experience is not None and profile.years_experience < 0:
        profile.years_experience = None
    if profile.seniority_level not in {"junior", "mid", "senior", "lead", "principal", "unknown"}:
        profile.seniority_level = "unknown"


async def parse_resume_llm(
    file_bytes: bytes,
    filename: str,
    uid: Optional[str] = None,
    persist: bool = True,
) -> ParsedResumeResponse:
    """
    LLM-authoritative resume parser (v2).
    - Layout-aware text extraction with word-level line rebuild.
    - Single Groq JSON call on numbered lines.
    - Minimal post-process: grounding, dedupe, sanitize, education normalize.
    """
    raw_text, extraction_meta = extract_text_with_metadata(file_bytes, filename)
    raw_text = (raw_text or "").replace("\x00", "").strip()
    if len(raw_text) < 20:
        raise ValueError(
            "No readable text could be extracted from the file. "
            "If this is a scanned/image PDF, please upload a text-based PDF or a DOCX."
        )

    numbered_text = _build_numbered_resume_prompt(_strip_link_footer(raw_text))
    pdf_links = extraction_meta.get("pdf_links") or []
    link_appendix = _build_pdf_links_prompt_appendix(pdf_links)
    user_prompt = f"Resume text with line numbers (UTF-8):\n\n{numbered_text}{link_appendix}"

    json_str = await get_platform_llm().json_completion(_RESUME_PARSER_SYSTEM_PROMPT, user_prompt)

    try:
        payload = json.loads(json_str or "{}")
    except json.JSONDecodeError:
        raise ValueError("LLM returned invalid JSON")

    profile_data = payload.get("profile") or {}
    profile_data.setdefault("raw_text", raw_text)
    if profile_data.get("weak_areas") is None:
        profile_data["weak_areas"] = []
    if profile_data.get("custom_sections") is None:
        profile_data["custom_sections"] = []

    profile = ResumeProfile(**profile_data)
    _apply_grounding_and_cleanup(
        profile,
        raw_text,
        pdf_links=pdf_links,
    )
    _merge_fallback_achievements(profile, raw_text)

    meta = {
        "uid": uid,
        "source": "groq_llm_resume_parser",
        "model": "groq/llama-3.1-8b-instant",
        "parsed_at": datetime.now(timezone.utc).isoformat(),
        "version": "v2",
        "extractor": extraction_meta,
    }

    if persist and uid:
        try:
            doc_ref = (
                db.collection("users")
                .document(uid)
                .collection("profiles")
                .document("resume_parsed")
            )
            doc_ref.set({"profile": profile.model_dump(), "meta": meta}, merge=True)
        except Exception:
            pass

    return ParsedResumeResponse(profile=profile, meta=meta)


def _element_text(el) -> str:
    return "".join((t.text or "") for t in el.iter() if hasattr(t, "text") and (t.text or ""))


def _paragraph_text_with_hyperlink_urls(doc: "docx.Document") -> str:
    lines = []
    for paragraph in doc.paragraphs:
        parts = []
        for el in paragraph._p:
            tag = el.tag.split("}")[-1] if "}" in el.tag else el.tag
            if tag == "hyperlink":
                r_id = el.get(qn("r:id"))
                url = ""
                if r_id and hasattr(doc.part, "rels") and doc.part.rels:
                    try:
                        rel = doc.part.rels[r_id]
                        url = getattr(rel, "target_ref", None) or getattr(rel, "_target", "") or ""
                    except (KeyError, TypeError, AttributeError):
                        pass
                if url:
                    parts.append(url)
                else:
                    parts.append(_element_text(el))
            elif tag == "r":
                parts.append(_element_text(el))
        line = "".join(parts).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def _pdf_link_uris(reader: "PdfReader") -> List[str]:
    uris: List[str] = []
    for page in reader.pages:
        try:
            annots = page.get("/Annots")
            if not annots:
                continue
            for ref in annots if isinstance(annots, list) else [annots]:
                try:
                    obj = ref.get_object() if hasattr(ref, "get_object") else ref
                    if not isinstance(obj, dict) or obj.get("/Subtype") != "/Link":
                        continue
                    a = obj.get("/A")
                    if not a:
                        continue
                    if hasattr(a, "get_object"):
                        a = a.get_object()
                    if not isinstance(a, dict):
                        continue
                    uri = a.get("/URI")
                    if uri is None:
                        continue
                    if hasattr(uri, "get_object"):
                        uri = uri.get_object()
                    if isinstance(uri, bytes):
                        uri = uri.decode("utf-8", errors="replace")
                    s = str(uri).strip()
                    if s and s not in uris:
                        uris.append(s)
                except Exception:
                    continue
        except Exception:
            continue
    return uris


def _pymupdf_link_uris(doc: Any) -> List[str]:
    uris: List[str] = []
    for page in doc:
        try:
            for link in page.get_links() or []:
                uri = str(link.get("uri") or "").strip()
                if uri and uri not in uris:
                    uris.append(uri)
        except Exception:
            continue
    return uris


def _with_link_footer(text: str, link_uris: List[str]) -> str:
    if not link_uris:
        return text
    return text.rstrip() + "\n\n[Links: " + ", ".join(link_uris) + "]"


def _pypdf2_pdf_text(file_bytes: bytes) -> Tuple[str, List[str], int]:
    reader = PdfReader(BytesIO(file_bytes))
    text = "\n".join([page.extract_text() or "" for page in reader.pages])
    return text, _pdf_link_uris(reader), len(reader.pages)


def _pypdf2_pdf_fallback(
    file_bytes: bytes,
    *,
    warning: str,
) -> Tuple[str, Dict[str, Any]]:
    meta: Dict[str, Any] = {
        "engine": "pypdf2_fallback",
        "page_count": 0,
        "likely_multicolumn": False,
        "text_length": 0,
        "warnings": [warning],
    }
    try:
        text, link_uris, page_count = _pypdf2_pdf_text(file_bytes)
    except Exception as exc:
        raise ValueError(f"Failed to read PDF: {exc}") from exc
    text = _with_link_footer(text, link_uris)
    meta["page_count"] = page_count
    meta["text_length"] = len(text)
    return text, meta


def _clean_pdf_block_text(value: Any) -> str:
    text = re.sub(r"[ \t]+", " ", str(value or ""))
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def _pdf_blocks_are_multicolumn(blocks: List[Dict[str, Any]], page_width: float) -> Tuple[bool, Optional[float]]:
    if page_width <= 0 or len(blocks) < 4:
        return False, None

    centers = sorted((float(block["x0"]) + float(block["x1"])) / 2 for block in blocks)
    best_index = -1
    best_gap = 0.0
    for index in range(len(centers) - 1):
        gap = centers[index + 1] - centers[index]
        if gap > best_gap:
            best_gap = gap
            best_index = index

    min_gap = max(45.0, page_width * 0.12)
    if best_index < 1 or best_index > len(centers) - 3 or best_gap < min_gap:
        return False, None

    divider = (centers[best_index] + centers[best_index + 1]) / 2
    left = [block for block in blocks if ((block["x0"] + block["x1"]) / 2) < divider]
    right = [block for block in blocks if ((block["x0"] + block["x1"]) / 2) >= divider]
    if len(left) < 2 or len(right) < 2:
        return False, None

    left_top, left_bottom = min(block["y0"] for block in left), max(block["y1"] for block in left)
    right_top, right_bottom = min(block["y0"] for block in right), max(block["y1"] for block in right)
    vertical_overlap = min(left_bottom, right_bottom) - max(left_top, right_top)
    if vertical_overlap < 40:
        return False, None

    return True, divider


def _order_pdf_text_blocks(blocks: List[Dict[str, Any]], page_width: float) -> Tuple[List[str], bool]:
    clean_blocks = [
        {**block, "text": text}
        for block in blocks
        if (text := str(block.get("text") or "").strip()) and (block.get("x1", 0) - block.get("x0", 0)) > 4
    ]
    is_multicolumn, divider = _pdf_blocks_are_multicolumn(clean_blocks, page_width)

    if is_multicolumn and divider is not None:
        left = [block for block in clean_blocks if ((block["x0"] + block["x1"]) / 2) < divider]
        right = [block for block in clean_blocks if ((block["x0"] + block["x1"]) / 2) >= divider]
        ordered = [
            *sorted(left, key=lambda block: (block["y0"], block["x0"])),
            *sorted(right, key=lambda block: (block["y0"], block["x0"])),
        ]
    else:
        ordered = sorted(clean_blocks, key=lambda block: (block["y0"], block["x0"]))

    return [block["text"] for block in ordered], is_multicolumn


def _rebuild_lines_from_page_blocks(page: Any) -> List[str]:
    raw_blocks = page.get_text("blocks") or []
    blocks: List[Dict[str, Any]] = []
    for block in raw_blocks:
        if len(block) < 5:
            continue
        blocks.append(
            {
                "x0": float(block[0]),
                "y0": float(block[1]),
                "x1": float(block[2]),
                "y1": float(block[3]),
                "text": block[4],
            }
        )
    ordered_texts, _ = _order_pdf_text_blocks(blocks, float(page.rect.width))
    return _split_extracted_lines([_clean_pdf_block_text(text) for text in ordered_texts if text])


def extract_pdf_text_layout_aware(file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    meta: Dict[str, Any] = {
        "engine": "pymupdf_words",
        "page_count": 0,
        "likely_multicolumn": False,
        "text_length": 0,
        "warnings": [],
    }

    if fitz is None:
        return _pypdf2_pdf_fallback(file_bytes, warning="pymupdf_unavailable")

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Failed to read PDF: {exc}") from exc

    try:
        meta["page_count"] = len(doc)
        page_texts: List[str] = []
        for page in doc:
            word_lines = _rebuild_lines_from_page_words(page)
            if not word_lines:
                meta["warnings"].append("word_extraction_empty_page")
                word_lines = _rebuild_lines_from_page_blocks(page)
            if word_lines:
                page_texts.append("\n".join(word_lines))

        text = "\n\n".join(page_texts)
        link_uris = _pymupdf_link_uris(doc)
        text = _with_link_footer(text, link_uris)
        meta["pdf_links"] = link_uris
        if not text.strip():
            meta["warnings"].append("low_text_extraction")
            meta["engine"] = "pymupdf_blocks_fallback"
        if len(text.strip()) < 80 and meta["page_count"]:
            meta["warnings"].append("likely_scanned_pdf")
        meta["text_length"] = len(text)
        return text, meta
    except Exception:
        return _pypdf2_pdf_fallback(file_bytes, warning="pymupdf_extraction_failed")
    finally:
        doc.close()


def extract_text_with_metadata(file_bytes: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
    fn = filename.lower()
    if fn.endswith(".pdf"):
        return extract_pdf_text_layout_aware(file_bytes)

    meta: Dict[str, Any] = {
        "engine": "python-docx" if fn.endswith(".docx") else "plain_text",
        "page_count": None,
        "likely_multicolumn": False,
        "text_length": 0,
        "warnings": [],
    }

    if fn.endswith(".docx"):
        try:
            doc = docx.Document(BytesIO(file_bytes))
            text = _paragraph_text_with_hyperlink_urls(doc)
            meta["text_length"] = len(text)
            return text, meta
        except Exception as exc:
            raise ValueError(f"Failed to read DOCX: {exc}") from exc

    if fn.endswith(".doc"):
        raise ValueError("Unsupported file type: .doc (please upload .docx)")

    try:
        text = file_bytes.decode("utf-8", errors="ignore")
        meta["text_length"] = len(text)
        return text, meta
    except Exception:
        meta["warnings"].append("text_decode_failed")
        return "", meta
