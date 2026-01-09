import re
from io import BytesIO
from typing import Dict, List, Any
from PyPDF2 import PdfReader
import docx

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

def extract_text(file_bytes: bytes, filename: str) -> str:
    fn = filename.lower()
    if fn.endswith('.pdf'):
        try:
            reader = PdfReader(BytesIO(file_bytes))
            return "\n".join([page.extract_text() or "" for page in reader.pages])
        except Exception as exc:
            raise ValueError(f"Failed to read PDF: {exc}") from exc

    # python-docx supports .docx (not legacy .doc)
    elif fn.endswith('.docx'):
        try:
            doc = docx.Document(BytesIO(file_bytes))
            return "\n".join(paragraph.text for paragraph in doc.paragraphs)
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

