from __future__ import annotations

from typing import Any, Dict, Set

from services.profile_memory.umbrella_terms import normalize_text


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

    raw_skills = resume_data.get("skills")
    if isinstance(raw_skills, dict):
        for values in raw_skills.values():
            if isinstance(values, list):
                for skill in values:
                    if isinstance(skill, str) and skill.strip():
                        known_skills.add(normalize_text(skill))
    elif isinstance(raw_skills, list):
        for skill in raw_skills:
            if isinstance(skill, str) and skill.strip():
                known_skills.add(normalize_text(skill))
            elif isinstance(skill, dict):
                name = str(skill.get("name") or "").strip()
                if name:
                    known_skills.add(normalize_text(name))

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
