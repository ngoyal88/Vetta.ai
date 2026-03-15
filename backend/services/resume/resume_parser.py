import re
import json
from datetime import datetime, timezone
from io import BytesIO
from typing import Dict, List, Any, Optional

from PyPDF2 import PdfReader
import docx
from docx.oxml.ns import qn

from firebase_config import db
from models.resume import ParsedResumeResponse, ResumeProfile
from services.integrations.groq_service import GroqService

def parse_resume(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Robust resume parser for PDF/DOCX/TXT files, tailored for tech resumes.
    Returns Affinda-style structure for easy plug-in to your workflow.
    """
    text = extract_text(file_bytes, filename)
    text = (text or "").replace("\x00", "").strip()
    if len(text) < 20:
        raise ValueError(
            "No readable text could be extracted from the file. "
            "If this is a scanned/image PDF, please upload a text-based PDF or a DOCX."
        )
    sections = split_sections(text)
    email, phone = extract_contact(text)
    name = extract_name(text, email)
    skills = extract_skills(sections)
    education = extract_education(sections)
    projects = extract_projects(sections)
    work_experience = extract_experience(sections)
    achievements = extract_achievements(sections)
    summary = extract_summary(sections, text)

    return {
        "data": {
            "name": {
                "raw": name,
                "first": name.split()[0] if name else "",
                "last": " ".join(name.split()[1:]) if name and len(name.split()) > 1 else "",
            },
            "phoneNumbers": [phone] if phone else [],
            "emails": [email] if email else [],
            "skills": [{"name": s} for s in skills],
            "workExperience": work_experience,
            "education": education,
            "projects": projects,
            "achievements": achievements,
            "summary": summary,
            "rawText": text
        },
        "meta": {
            "identifier": "custom_parser_v2",
            "ready": True,
            "failed": False
        }
    }


async def parse_resume_llm(file_bytes: bytes, filename: str, uid: str) -> ParsedResumeResponse:
    """
    LLM-powered resume parser.
    - Extracts raw text.
    - Calls Groq llama-3.1-8b-instant in JSON mode.
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
        '    "skills": {\n'
        '      "languages": string array,\n'
        '      "frameworks": string array,\n'
        '      "databases": string array,\n'
        '      "cloud": string array,\n'
        '      "tools": string array,\n'
        '      "ml_ai": string array,\n'
        '      "other": string array\n'
        "    },\n"
        '    "education": [\n'
        "      {\n"
        '        "degree": string or null,\n'
        '        "field": string or null,\n'
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
        '        "employment_type": string or null,\n'
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
    )

    truncated_text = raw_text[:12000]
    user_prompt = f"Resume text (UTF-8):\\n\\n{truncated_text}"

    groq = GroqService()
    json_str = await groq.json_completion(system_prompt, user_prompt)

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

    # Filter skills by category
    def _filter_list(values: List[str]) -> List[str]:
        return [v for v in values if _in_text(v, text_norm)]

    profile.skills.languages = _filter_list(profile.skills.languages)
    profile.skills.frameworks = _filter_list(profile.skills.frameworks)
    profile.skills.databases = _filter_list(profile.skills.databases)
    profile.skills.cloud = _filter_list(profile.skills.cloud)
    profile.skills.tools = _filter_list(profile.skills.tools)
    profile.skills.ml_ai = _filter_list(profile.skills.ml_ai)
    profile.skills.other = _filter_list(profile.skills.other)

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

    # Filter work experience: require company or title to appear
    filtered_experience = []
    for w in profile.work_experience:
        if _in_text(w.company, text_norm) or _in_text(w.title, text_norm):
            filtered_experience.append(w)
    profile.work_experience = filtered_experience

    # Filter achievements and publications by title
    profile.achievements = [
        a for a in profile.achievements if _in_text(a.title, text_norm)
    ]
    profile.publications = [
        p for p in profile.publications if _in_text(p.title, text_norm)
    ]

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
        'achievements': ['achievements', 'awards', 'certifications'],
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

def extract_contact(text: str) -> tuple[str, str]:
    email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
    phone_match = re.search(
        r"(\+91|0)?[\s\-]?\d{10,12}|\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}",
        text.replace('\n', ' ')
    )
    email = email_match.group(0) if email_match else ""
    phone = phone_match.group(0).strip() if phone_match else ""
    return (email, phone)

def extract_name(text: str, email: str) -> str:
    # Heuristic: pick first non-empty line that's not contact info
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    email_user = email.split('@')[0] if email else ""
    for l in lines:
        if email and email in l: continue
        if re.search(r'\d', l): continue
        if len(l.split()) > 1 and len(l) < 40 and all(w[0].isupper() for w in l.split() if w[0].isalpha()):
            return l
    # fallback: username part of email
    if email_user:
        return " ".join(email_user.split(".")).title()
    return ""

def extract_skills(sections: Dict[str, List[str]]) -> List[str]:
    # Hard-coded tech keyword database for demo; can be expanded
    skills_db = [
        'python', 'c', 'c++', 'golang', 'javascript', 'sql', 'matlab', 'r', 'java', 'streamlit', 'pytorch',
        'lstm', 'librosa', 'react', 'redux', 'html', 'css', 'mongodb', 'faiss', 'firebase', 'aws', 'docker',
        'redis', 'fastapi', 'flask', 'node.js', 'passport.js', 'bootstrap', 'tailwindcss', 'xgboost', 'lightgbm',
        'opencv', 'numpy', 'pandas', 'matplotlib', 'seaborn', 'postman', 'github', 'git', 'xcode', 'figma', 'chakra ui'
    ]
    found = set()
    skilltext = ' '.join(sections.get('skills', [])) or ' '.join(sections.get('full', []))
    skilltext = skilltext.lower()
    for s in skills_db:
        if s.lower() in skilltext:
            found.add(s)
    return sorted(found)

def extract_education(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    items = []
    edu_lines = sections.get('education', []) or []
    for l in edu_lines:
        if not l: continue
        degree = ""
        institution = ""
        year = ""
        cgpa = ""
        # find degree
        match_deg = re.search(r"(bachelor.*|master.*|ph\.?d|diploma.*|degree.*|in.*engineering)", l, re.I)
        if match_deg:
            degree = match_deg.group(0)
        # find institution
        inst = re.search(r"(university|institute|college|school|thapar.*?)", l, re.I)
        if inst:
            institution = inst.group(0)
        # year or CGPA
        year_match = re.search(r"(20\d{2}|19\d{2})", l)
        if year_match:
            year = year_match.group(0)
        cgpa_match = re.search(r"(cgpa\s*[:\-]?\s*[\d\.]+)", l, re.I)
        if cgpa_match:
            cgpa = cgpa_match.group(0)
        items.append({
            "degree": degree or l,
            "institution": institution,
            "dates": year if year else "",
            "cgpa": cgpa if cgpa else ""
        })
    return items

def extract_projects(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    projects = []
    lines = sections.get('projects', []) or []
    curr = {}
    for l in lines:
        if '|' in l or 'Source Code' in l:
            if curr: projects.append(curr)
            curr = {"name": "", "description": "", "technologies": []}
            # e.g. "IntervueAI | React.js, FastAPI, ..." → extract name/tech
            parts = l.split('|')
            curr['name'] = parts[0].strip()
            if len(parts) > 1:
                curr['technologies'] = [s.strip() for s in parts[1].split(',') if len(s.strip()) > 0]
            continue
        if l.startswith("•") or l.startswith("-"):
            desc = l.lstrip("•- ").strip()
            curr["description"] = curr.get("description", "") + desc + " "
        elif "Source Code" in l:
            continue  # skip
        elif l:
            if not curr.get("description"):
                curr["description"] = l
    if curr: projects.append(curr)
    # remove empty items
    return [p for p in projects if p.get("name") or p.get("description")]

def extract_experience(sections: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    # For students, "Projects" often overlaps with "Experience" so this returns empty for most resumes like yours.
    # Otherwise, for professionals, parse as needed.
    return []

def extract_achievements(sections: Dict[str, List[str]]) -> List[str]:
    achieves = []
    for l in sections.get("achievements", []):
        if not l: continue
        achieves.append(l)
    return achieves

def extract_summary(sections: Dict[str, List[str]], text: str) -> str:
    summ_sect = sections.get("summary", [])
    if summ_sect:
        return " ".join(summ_sect[:4])
    # Fallback: intro lines before Education/Projects/Skills
    intro_lines = []
    for l in text.splitlines():
        l = l.strip()
        lower = l.lower()
        if any(header in lower for header in ["education", "projects", "skills", "achievements", "technical skills", "experience"]):
            break
        if l and len(l) > 8 and not re.search(r'^\d+$', l):
            intro_lines.append(l)
    return " ".join(intro_lines[:3])

