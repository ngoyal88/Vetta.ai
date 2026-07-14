from __future__ import annotations

import uuid
from typing import Sequence

from models.resume import CustomSectionItem, ResumeProfile
from services.resume_builder.models import (
    BuilderCustomSection,
    BuilderSection,
    BuilderSectionKind,
    default_section_layout,
)

BUILTIN_CONTENT_KINDS: tuple[BuilderSectionKind, ...] = (
    "summary",
    "work_experience",
    "education",
    "skills",
    "projects",
    "achievements",
    "publications",
)


def section_has_content(profile: ResumeProfile, kind: BuilderSectionKind) -> bool:
    if kind == "identity":
        return True
    if kind == "summary":
        return isinstance(profile.summary, str) and bool(profile.summary.strip())
    if kind == "skills":
        return any(group.label.strip() or any(item.strip() for item in group.items) for group in profile.skills)
    if kind == "projects":
        return any(
            any(
                isinstance(value, str) and value.strip()
                for value in [
                    item.name,
                    item.description,
                    item.role,
                    item.scale,
                    item.start_date,
                    item.end_date,
                    item.link,
                ]
            )
            or any(skill.strip() for skill in item.tech_stack)
            for item in profile.projects
        )
    if kind == "work_experience":
        return any(
            any(
                isinstance(value, str) and value.strip()
                for value in [
                    item.title,
                    item.company,
                    item.location,
                    item.start_date,
                    item.end_date,
                    item.employment_type,
                ]
            )
            or any(text.strip() for text in [*item.responsibilities, *item.impact, *item.tech_stack])
            for item in profile.work_experience
        )
    if kind == "education":
        return any(
            any(
                isinstance(value, str) and value.strip()
                for value in [
                    item.degree,
                    item.field,
                    item.minor,
                    item.institution,
                    item.start_date,
                    item.end_date,
                    item.cgpa,
                    item.location,
                ]
            )
            or any((highlight.label.strip() or highlight.text.strip()) for highlight in item.highlights)
            for item in profile.education
        )
    if kind == "achievements":
        return any(
            any(isinstance(value, str) and value.strip() for value in [item.title, item.description, item.date])
            for item in profile.achievements
        )
    if kind == "publications":
        return any(
            any(isinstance(value, str) and value.strip() for value in [item.title, item.venue, item.year, item.link])
            for item in profile.publications
        )
    return False



def import_custom_sections(
    profile: ResumeProfile,
) -> tuple[list[BuilderSection], list[BuilderCustomSection]]:
    layout_rows: list[BuilderSection] = []
    custom_sections: list[BuilderCustomSection] = []

    for item in profile.custom_sections:
        title = (item.title or "").strip()
        lines = [line.strip() for line in item.lines if isinstance(line, str) and line.strip()]
        if not title and not lines:
            continue

        custom_id = f"custom_{uuid.uuid4().hex[:8]}"
        label = title or "Custom Section"
        custom_sections.append(
            BuilderCustomSection(
                id=custom_id,
                title=label,
                content="\n".join(lines),
            )
        )
        layout_rows.append(
            BuilderSection(
                id=custom_id,
                kind="custom",
                label=label,
                enabled=True,
            )
        )

    return layout_rows, custom_sections


def derive_layout_from_profile(
    profile: ResumeProfile,
) -> tuple[list[BuilderSection], list[BuilderCustomSection], ResumeProfile]:
    layout = [section.model_copy(deep=True) for section in default_section_layout()]

    for section in layout:
        if section.kind == "identity":
            section.enabled = True
            continue
        section.enabled = section_has_content(profile, section.kind)

    custom_layout_rows, custom_sections = import_custom_sections(profile)
    layout.extend(custom_layout_rows)

    cleared_profile = profile.model_copy(update={"custom_sections": []})
    return layout, custom_sections, cleared_profile


def builder_custom_sections_to_profile(
    profile: ResumeProfile,
    custom_sections: Sequence[BuilderCustomSection],
) -> ResumeProfile:
    items: list[CustomSectionItem] = []
    for section in custom_sections:
        title = (section.title or "").strip()
        lines = [line.strip() for line in (section.content or "").splitlines() if line.strip()]
        if not title and not lines:
            continue
        items.append(CustomSectionItem(title=title or "Custom Section", lines=lines))
    return profile.model_copy(update={"custom_sections": items})
