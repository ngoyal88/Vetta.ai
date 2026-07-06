from __future__ import annotations

from typing import Any, Dict, Set

from services.profile_memory.umbrella_terms import normalize_text
from services.resume.skills_normalizer import flatten_skills_from_profile


def extract_resume_known_items(resume_data: Dict[str, Any]) -> Dict[str, Set[str]]:
    known_projects: Set[str] = set()
    known_skills: Set[str] = set()
    known_text_blobs: Set[str] = set()
    if not isinstance(resume_data, dict):
        return {"projects": known_projects, "skills": known_skills, "text": known_text_blobs}

    raw_projects = resume_data.get("projects") or []
    for project in raw_projects:
        if isinstance(project, dict):
            name = str(project.get("name") or "").strip()
            if name:
                known_projects.add(normalize_text(name))
            desc = str(project.get("description") or "").strip()
            if desc:
                known_text_blobs.add(normalize_text(desc))
        elif isinstance(project, str) and project.strip():
            known_projects.add(normalize_text(project))

    for skill in flatten_skills_from_profile(resume_data):
        known_skills.add(normalize_text(skill))

    experience = resume_data.get("work_experience") or resume_data.get("workExperience") or []
    if isinstance(experience, list):
        for item in experience:
            if not isinstance(item, dict):
                continue
            for key in ("title", "company", "description", "summary"):
                val = str(item.get(key) or "").strip()
                if val:
                    known_text_blobs.add(normalize_text(val))

    summary = str(resume_data.get("summary") or "").strip()
    if summary:
        known_text_blobs.add(normalize_text(summary))

    return {"projects": known_projects, "skills": known_skills, "text": known_text_blobs}
