import re
import json
from datetime import datetime, timezone
from io import BytesIO
from typing import Dict, List, Any, Optional

from PyPDF2 import PdfReader
import docx
from docx.oxml.ns import qn

from firebase_config import db
from models.resume import (
    AchievementItem,
    EducationRecord,
    ParsedResumeResponse,
    ProjectItem,
    ResumeProfile,
    SkillGroup,
)
from services.interview.llm_engine import get_platform_llm
from services.resume.resume_postprocess import (
    dedupe_achievements,
    merge_education_entries,
    normalize_education_record,
    parse_degree_field_minor,
    sanitize_profile_links_and_skills,
)

async def parse_resume_llm(
    file_bytes: bytes,
    filename: str,
    uid: Optional[str] = None,
    persist: bool = True,
) -> ParsedResumeResponse:
    """
    LLM-powered resume parser.
    - Extracts raw text.
    - Calls Groq llama-3.1-8b-instant in JSON mode (via GroqService.json_completion).
    - Validates against ResumeProfile.
    - Drops hallucinated skills/projects/experience entries not present in the raw text.
    - Writes the parsed profile to Firestore under users/{uid}/profiles/resume_parsed.
    """
    raw_text = extract_text(file_bytes, filename)
    raw_text = (raw_text or "").replace("\x00", "").strip()
    if len(raw_text) < 20:
        raise ValueError(
            "No readable text could be extracted from the file. "
            "If this is a scanned/image PDF, please upload a text-based PDF or a DOCX."
        )

    system_prompt = (
        "You are an extraction engine for technical resumes. "
        "Return ONLY a JSON object matching this schema (no extra keys, no comments):\n"
        "{\n"
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
        '    "skills": [\n'
        "      {\n"
        '        "label": string,\n'
        '        "items": string array\n'
        "      }\n"
        "    ],\n"
        '    "education": [\n'
        "      {\n"
        '        "degree": string or null,\n'
        '        "field": string or null,\n'
        '        "minor": string or null,\n'
        '        "institution": string or null,\n'
        '        "start_date": string or null,\n'
        '        "end_date": string or null,\n'
        '        "cgpa": string or null,\n'
        '        "location": string or null\n'
        "      }\n"
        "    ],\n"
        '    "work_experience": [\n'
        "      {\n"
        '        "title": string or null,\n'
        '        "company": string or null,\n'
        '        "location": string or null,\n'
        '        "start_date": string or null,\n'
        '        "end_date": string or null,\n'
        '        "employment_type": "intern" | "full_time" | "part_time" | "contract" | "freelance" | "co_op" | "temporary" | "volunteer" | "other" | null,\n'
        '        "responsibilities": string array,\n'
        '        "tech_stack": string array,\n'
        '        "impact": string array\n'
        "      }\n"
        "    ],\n"
        '    "projects": [\n'
        "      {\n"
        '        "name": string or null,\n'
        '        "description": string or null,\n'
        '        "tech_stack": string array,\n'
        '        "role": string or null,\n'
        '        "scale": string or null,\n'
        '        "start_date": string or null,\n'
        '        "end_date": string or null,\n'
        '        "link": string or null\n'
        "      }\n"
        "    ],\n"
        '    "achievements": [ { "title": string, "description": string or null, "date": string or null } ],\n'
        '    "publications": [ { "title": string, "venue": string or null, "year": string or null, "link": string or null } ],\n'
        '    "weak_areas": string array,\n'
        '    "raw_text": string or null\n'
        "  },\n"
        '  "meta": { "uid": string, "source": string, "model": string, "parsed_at": string, "version": string }\n'
        "}\n\n"
        "STRICT RULES:\n"
        "- Only include skills, tools, frameworks, projects, experience entries, achievements, and publications that are EXPLICITLY mentioned in the resume text.\n"
        "- Do NOT guess or infer technologies or companies that are not clearly present.\n"
        "- Keep strings concise; do not paraphrase entire paragraphs.\n"
        "- For each work_experience row, set employment_type to one of the allowed enum values "
        "when the resume explicitly states it (e.g. in title, company line, or dates). "
        "Use null when not stated — do not guess.\n"
    )

    # Keep under Groq on-demand TPM limits when combined with the large system prompt.
    truncated_text = raw_text[:6000]
    user_prompt = f"Resume text (UTF-8):\\n\\n{truncated_text}"

    json_str = await get_platform_llm().json_completion(system_prompt, user_prompt)

    try:
        payload = json.loads(json_str or "{}")
    except json.JSONDecodeError:
        raise ValueError("LLM returned invalid JSON")

    profile_data = payload.get("profile") or {}
    # Attach raw_text so downstream has full context, but we will still use it for validation.
    profile_data.setdefault("raw_text", raw_text)
    # Some models may emit null for list fields; normalize to empty lists so
    # pydantic's non-optional List[str] fields validate correctly.
    if profile_data.get("weak_areas") is None:
        profile_data["weak_areas"] = []

    profile = ResumeProfile(**profile_data)

    # Validation / de-hallucination layer
    def _in_text(value: Optional[str], text_norm: str) -> bool:
        if not value:
            return False
        v = value.strip().lower()
        if not v:
            return False
        return v in text_norm

    text_norm = raw_text.lower()

    # Filter skill groups against resume text grounding
    def _filter_list(values: List[str]) -> List[str]:
        return [v for v in values if _in_text(v, text_norm)]

    profile.skills = [
        SkillGroup(label=group.label, items=_filter_list(group.items))
        for group in profile.skills
        if group.label or group.items
    ]

    sections = split_sections(raw_text)

    # Filter projects: require name or a key phrase from description to appear
    filtered_projects = []
    for p in profile.projects:
        keep = False
        if _in_text(p.name, text_norm):
            keep = True
        elif p.description:
            snippet = p.description[:64]
            keep = _in_text(snippet, text_norm)
        if keep:
            filtered_projects.append(p)
    profile.projects = filtered_projects

    _enrich_profile_education(profile, sections)
    _enrich_profile_projects(profile, sections)

    # Filter work experience: require company or title to appear
    filtered_experience = []
    for w in profile.work_experience:
        if _in_text(w.company, text_norm) or _in_text(w.title, text_norm):
            filtered_experience.append(w)
    profile.work_experience = filtered_experience

    fallback_achievements = [AchievementItem(**item) for item in extract_achievements(sections)]
    profile.achievements = dedupe_achievements([*profile.achievements, *fallback_achievements])

    # Filter achievements and publications by title
    profile.achievements = [
        a
        for a in profile.achievements
        if _in_text(a.title, text_norm)
        or (a.description and _in_text(a.description[:64], text_norm))
    ]
    profile.publications = [
        p for p in profile.publications if _in_text(p.title, text_norm)
    ]

    sanitize_profile_links_and_skills(profile)

    # Normalize years_experience / seniority if clearly invalid
    if profile.years_experience is not None and profile.years_experience < 0:
        profile.years_experience = None
    if profile.seniority_level not in {"junior", "mid", "senior", "lead", "principal", "unknown"}:
        profile.seniority_level = "unknown"

    meta = {
        "uid": uid,
        "source": "groq_llm_resume_parser",
        "model": "groq/llama-3.1-8b-instant",
        "parsed_at": datetime.now(timezone.utc).isoformat(),
        "version": "v1",
    }

    # Persist to Firestore (best-effort)
    if persist and uid:
        try:
            doc_ref = (
                db.collection("users")
                .document(uid)
                .collection("profiles")
                .document("resume_parsed")
            )
            doc_ref.set({"profile": profile.dict(), "meta": meta}, merge=True)
        except Exception:
            # Do not fail the request solely due to Firestore issues
            pass

    return ParsedResumeResponse(profile=profile, meta=meta)


def _element_text(el) -> str:
    """Collect all text from an XML element and its descendants (e.g. w:r or w:hyperlink)."""
    return "".join((t.text or "") for t in el.iter() if hasattr(t, "text") and (t.text or ""))


def _paragraph_text_with_hyperlink_urls(doc: "docx.Document") -> str:
    """Build paragraph text, replacing hyperlink anchor text with the actual URL."""
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
    """Extract all URI links from PDF page annotations."""
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


def extract_text(file_bytes: bytes, filename: str) -> str:
    fn = filename.lower()
    if fn.endswith('.pdf'):
        try:
            reader = PdfReader(BytesIO(file_bytes))
            text = "\n".join([page.extract_text() or "" for page in reader.pages])
            link_uris = _pdf_link_uris(reader)
            if link_uris:
                text = text.rstrip() + "\n\n[Links: " + ", ".join(link_uris) + "]"
            return text
        except Exception as exc:
            raise ValueError(f"Failed to read PDF: {exc}") from exc

    # python-docx supports .docx (not legacy .doc)
    elif fn.endswith('.docx'):
        try:
            doc = docx.Document(BytesIO(file_bytes))
            return _paragraph_text_with_hyperlink_urls(doc)
        except Exception as exc:
            raise ValueError(f"Failed to read DOCX: {exc}") from exc

    elif fn.endswith('.doc'):
        raise ValueError("Unsupported file type: .doc (please upload .docx)")
    else:
        try:
            return file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            return ""

def split_sections(text: str) -> Dict[str, List[str]]:
    # Map section headers to normalized keys
    section_map = {
        'education': ['education', 'coursework'],
        'projects': ['projects', 'research', 'research projects'],
        'skills': ['technical skills', 'skills', 'technologies', 'languages', 'libraries & frameworks', 'developer tools'],
        'achievements': ['achievement', 'achievements', 'awards', 'certifications'],
        'work': ['experience', 'work experience', 'internship', 'positions', 'employment', 'professional experience'],
        'summary': ['summary', 'about', 'profile'],
    }
    # Parse the text into sections
    lines = [l.strip() for l in text.splitlines()]
    sections = {}
    current = None
    def _normalize_header(s: str) -> str:
        # Keep alphanumerics and a few separators; collapse whitespace.
        s = s.lower().strip()
        s = re.sub(r"[^a-z0-9&\s]", " ", s)
        s = re.sub(r"\s+", " ", s).strip(" :")
        return s

    for ln in lines:
        ln_norm = _normalize_header(ln)
        # Detect section header (exact OR prefix match; e.g., "education" or "education and certifications")
        found = [
            k
            for k, hdrs in section_map.items()
            if any(ln_norm == h or ln_norm.startswith(h + " ") for h in hdrs)
        ]
        if found:
            current = found[0]
            sections.setdefault(current, [])
            continue
        if current:
            # Group content under the current section
            if ln:  # Skip empty lines
                sections[current].append(ln)
    # fallback if missing
    if not sections: sections['full'] = lines
    return sections

def extract_education(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    current: Dict[str, Any] | None = None
    edu_lines = sections.get("education", []) or []

    def _flush() -> None:
        nonlocal current
        if current and any(current.get(key) for key in ("degree", "field", "minor", "institution", "dates", "cgpa")):
            items.append(normalize_education_record(current))
        current = None

    for raw_line in edu_lines:
        if not raw_line:
            continue
        line = raw_line.strip()
        lower = line.lower()
        has_degree = bool(re.search(r"(bachelor|master|ph\.?d|b\.?e\.?|b\.?tech|m\.?tech|degree)", lower))
        has_institution = bool(re.search(r"\b(university|institute|college|school)\b", lower))
        has_year = bool(re.search(r"(20\d{2}|19\d{2})", line))
        has_cgpa = bool(re.search(r"(cgpa|gpa)\s*[:\-]?\s*[\d\.]+", line, re.I))

        if current and has_cgpa and not current.get("cgpa"):
            cgpa_match = re.search(r"((?:cgpa|gpa)\s*[:\-]?\s*[\d\.]+(?:/\d+(?:\.\d+)?)?)", line, re.I)
            if cgpa_match:
                current["cgpa"] = cgpa_match.group(1)
            continue

        if current and has_year and not (has_degree or has_institution):
            date_match = re.findall(r"(20\d{2}|19\d{2}|present|current)", line, re.I)
            if date_match:
                current["dates"] = " - ".join(date_match[:2]) if len(date_match) > 1 else date_match[0]
            continue

        if has_institution and not has_degree and " in " not in lower:
            _flush()
            parts = [part.strip() for part in line.split(",")]
            head = parts[0]
            institution_match = re.search(
                r"([A-Z][A-Za-z&\-\.\s]+(?:University|Institute|College|School)(?:\s+of\s+[A-Za-z&\-\.\s]+)?(?:\s+and\s+[A-Za-z&\-\.\s]+)?)",
                head,
            )
            current = {
                "degree": "",
                "field": "",
                "minor": "",
                "institution": institution_match.group(1).strip(" ,.-") if institution_match else head,
                "dates": "",
                "cgpa": "",
                "location": parts[1] if len(parts) > 1 else "",
            }
            continue

        if has_degree or " in " in lower:
            degree, field, minor = parse_degree_field_minor(line)
            if current is None:
                current = {
                    "degree": "",
                    "field": "",
                    "minor": "",
                    "institution": "",
                    "dates": "",
                    "cgpa": "",
                    "location": "",
                }
            current["degree"] = degree
            current["field"] = field
            current["minor"] = minor
            date_match = re.findall(r"(20\d{2}|19\d{2}|present|current)", line, re.I)
            if date_match and not current.get("dates"):
                current["dates"] = " - ".join(date_match[:2]) if len(date_match) > 1 else date_match[0]
            cgpa_match = re.search(r"((?:cgpa|gpa)\s*[:\-]?\s*[\d\.]+(?:/\d+(?:\.\d+)?)?)", line, re.I)
            if cgpa_match and not current.get("cgpa"):
                current["cgpa"] = cgpa_match.group(1)
            continue

    _flush()
    return merge_education_entries(items)

def extract_projects(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    projects = []
    lines = sections.get('projects', []) or []
    curr: Dict[str, Any] | None = None

    def _flush() -> None:
        nonlocal curr
        if curr and any(curr.get(key) for key in ("name", "description", "link", "tech_stack")):
            curr["description"] = str(curr.get("description") or "").strip()
            curr["tech_stack"] = list(dict.fromkeys(curr.get("tech_stack") or []))
            projects.append(curr)
        curr = None

    def _looks_like_project_title(line: str) -> bool:
        if line.startswith(("•", "-")):
            return False
        if re.search(r"\b(link|live link|source code)\b", line, re.I):
            return True
        if len(line) > 120:
            return False
        titleish = re.match(r"^[A-Za-z0-9][A-Za-z0-9\s&+:/().,'-]{3,}$", line)
        return bool(titleish)

    tech_pattern = re.compile(
        r"\b(C\+\+|Python|JavaScript|TypeScript|SQL|FastAPI|Node\.js|Express\.js|ReactJS|React|Next\.js|MongoDB|Redis|Firebase|SQLite|GCP|AWS|Docker|LangChain|TensorFlow|PyTorch|scikit-learn|Gemini|Ollama|Vertex AI|Bedrock|WebSockets?)\b",
        re.I,
    )

    for l in lines:
        line = l.strip()
        if not line:
            continue
        url_match = re.search(r"(https?://\S+|www\.\S+)", line, re.I)
        if _looks_like_project_title(line) and (curr is None or curr.get("description") or curr.get("link")):
            _flush()
            curr = {
                "name": "",
                "description": "",
                "tech_stack": [],
                "role": "",
                "scale": "",
                "start_date": "",
                "end_date": "",
                "link": "",
            }

        if curr is None:
            curr = {
                "name": "",
                "description": "",
                "tech_stack": [],
                "role": "",
                "scale": "",
                "start_date": "",
                "end_date": "",
                "link": "",
            }

        if not curr["name"]:
            title_line = re.sub(r"\b(Link|Live Link|Source Code)\b.*$", "", line, flags=re.I).strip(" -|")
            curr["name"] = title_line or line

        if url_match and not curr.get("link"):
            curr["link"] = url_match.group(1).rstrip(").,")

        for tech in tech_pattern.findall(line):
            cleaned = tech.strip()
            if cleaned and cleaned not in curr["tech_stack"]:
                curr["tech_stack"].append(cleaned)

        if line.startswith(("•", "-")):
            desc = line.lstrip("•- ").strip()
            curr["description"] = f"{curr.get('description', '')} {desc}".strip()
        elif curr.get("name") and line != curr.get("name"):
            curr["description"] = f"{curr.get('description', '')} {line}".strip()

    _flush()
    return projects

def extract_achievements(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    achieves = []
    for l in sections.get("achievements", []):
        if not l:
            continue
        line = l.lstrip("•- ").strip()
        if not line:
            continue
        date_match = re.search(r"(20\d{2}|19\d{2})", line)
        title, description = line, ""
        if ":" in line:
            title, description = [part.strip() for part in line.split(":", 1)]
        elif " - " in line and len(line.split(" - ", 1)[0]) < 80:
            title, description = [part.strip() for part in line.split(" - ", 1)]
        achieves.append({
            "title": title,
            "description": description,
            "date": date_match.group(1) if date_match else "",
        })
    return achieves

def _enrich_profile_education(profile: ResumeProfile, sections: Dict[str, List[str]]) -> None:
    """Merge LLM education rows with deterministic section extraction."""
    fallback = extract_education(sections)
    if not profile.education:
        profile.education = [EducationRecord(**item) for item in fallback]
        return

    normalized: List[EducationRecord] = []
    for index, record in enumerate(profile.education):
        merged = {**record.model_dump(), **(fallback[index] if index < len(fallback) else {})}
        normalized.append(EducationRecord(**normalize_education_record(merged)))

    if len(fallback) > len(normalized):
        normalized.extend(EducationRecord(**item) for item in fallback[len(normalized):])

    merged_rows = merge_education_entries(item.model_dump() for item in normalized)
    profile.education = [EducationRecord(**row) for row in merged_rows]


def _enrich_profile_projects(profile: ResumeProfile, sections: Dict[str, List[str]]) -> None:
    """Backfill project fields missing from the LLM output."""
    fallback = extract_projects(sections)
    if not profile.projects:
        profile.projects = [ProjectItem(**item) for item in fallback]
        return

    enriched: List[ProjectItem] = []
    for index, project in enumerate(profile.projects):
        fb = fallback[index] if index < len(fallback) else {}
        enriched.append(
            ProjectItem(
                **{
                    **project.model_dump(),
                    "description": project.description or fb.get("description"),
                    "link": project.link or fb.get("link"),
                    "tech_stack": project.tech_stack or fb.get("tech_stack", []),
                }
            )
        )
    profile.projects = enriched

