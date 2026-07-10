from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional, Sequence

from pydantic import BaseModel, Field, model_validator

from models.resume import ResumeProfile

TemplateStatus = Literal["live", "coming_soon"]
BuilderSectionKind = Literal[
    "identity",
    "summary",
    "work_experience",
    "education",
    "skills",
    "projects",
    "achievements",
    "publications",
    "custom",
]


class TemplateSectionConfig(BaseModel):
    fields: list[str] = Field(default_factory=list)


class TemplateMetadata(BaseModel):
    id: str
    version: str
    display_name: str = ""
    description: str = ""
    status: TemplateStatus = "coming_soon"
    tags: list[str] = Field(default_factory=list)
    preview_asset: str = ""
    supports_flexible_sections: bool = True
    sections: dict[str, TemplateSectionConfig] = Field(default_factory=dict)


class BuilderSection(BaseModel):
    id: str
    kind: BuilderSectionKind
    label: str
    enabled: bool = True


class BuilderCustomSection(BaseModel):
    id: str
    title: str
    content: str = ""


def default_section_layout() -> list[BuilderSection]:
    return [
        BuilderSection(id="identity", kind="identity", label="Identity", enabled=True),
        BuilderSection(id="summary", kind="summary", label="Summary", enabled=True),
        BuilderSection(id="experience", kind="work_experience", label="Experience", enabled=True),
        BuilderSection(id="education", kind="education", label="Education", enabled=True),
        BuilderSection(id="skills", kind="skills", label="Skills", enabled=True),
        BuilderSection(id="projects", kind="projects", label="Projects", enabled=True),
        BuilderSection(id="achievements", kind="achievements", label="Achievements", enabled=False),
        BuilderSection(id="publications", kind="publications", label="Publications", enabled=False),
    ]


class ResumeBuilderDraft(BaseModel):
    id: str
    user_id: str
    name: str = "Resume(1)"
    created_at: datetime
    updated_at: datetime
    template_id: str
    template_version: str
    profile: ResumeProfile = Field(default_factory=ResumeProfile)
    section_layout: list[BuilderSection] = Field(default_factory=default_section_layout)
    custom_sections: list[BuilderCustomSection] = Field(default_factory=list)
    target_resume_id: Optional[str] = None
    source_resume_id: Optional[str] = None
    source_version_id: Optional[str] = None
    status: Literal["draft"] = "draft"

    @model_validator(mode="after")
    def validate_layout(self) -> "ResumeBuilderDraft":
        identity_sections = [section for section in self.section_layout if section.kind == "identity"]
        if len(identity_sections) != 1:
            raise ValueError("Builder draft must contain exactly one identity section")
        identity = identity_sections[0]
        if not identity.enabled:
            raise ValueError("Identity section cannot be disabled")

        layout_ids = {section.id for section in self.section_layout}
        if len(layout_ids) != len(self.section_layout):
            raise ValueError("Section ids must be unique")

        custom_ids = {section.id for section in self.custom_sections}
        if len(custom_ids) != len(self.custom_sections):
            raise ValueError("Custom section ids must be unique")

        for custom in self.custom_sections:
            if custom.id not in layout_ids:
                raise ValueError("Every custom section must appear in section_layout")

        return self


class CreateDraftRequest(BaseModel):
    template_id: str = "professional_v1"
    resume_id: Optional[str] = None
    version_id: Optional[str] = None
    profile: Optional[ResumeProfile] = None


class DraftUpdateRequest(BaseModel):
    name: str
    profile: ResumeProfile
    section_layout: list[BuilderSection]
    custom_sections: list[BuilderCustomSection] = Field(default_factory=list)
    target_resume_id: Optional[str] = None


class DraftPatchRequest(BaseModel):
    name: Optional[str] = None
    profile: Optional[ResumeProfile] = None
    section_layout: Optional[list[BuilderSection]] = None
    custom_sections: Optional[list[BuilderCustomSection]] = None
    target_resume_id: Optional[str] = None


class DraftResponse(BaseModel):
    draft: ResumeBuilderDraft


class DraftListResponse(BaseModel):
    drafts: list[ResumeBuilderDraft]


class TemplateListResponse(BaseModel):
    templates: list[TemplateMetadata]


class LatexResponse(BaseModel):
    tex: str


class HealthResponse(BaseModel):
    enabled: bool
    compile_ok: bool


class PublishDraftRequest(BaseModel):
    user_note: str = ""
    target_resume_id: Optional[str] = None
    resume_name: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    set_active: bool = True


class PublishDraftResponse(BaseModel):
    resume_id: str
    version_id: str
    entry: dict[str, Any]
    version: dict[str, Any]
    scorecard: dict[str, Any]


class BuilderValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

    def as_detail(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


def default_resume_name(profile: ResumeProfile) -> str:
    if isinstance(profile.name, str) and profile.name.strip():
        return f"{profile.name.strip()} Resume"
    return "Vetta Resume"


def validate_identity_fields(profile: ResumeProfile) -> None:
    name = (profile.name or "").strip() if isinstance(profile.name, str) else ""
    email = (profile.contact.email or "").strip() if profile.contact else ""
    if not name:
        raise BuilderValidationError("identity_name_missing", "Name is required")
    if not email:
        raise BuilderValidationError("identity_email_missing", "Email is required")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise BuilderValidationError("identity_email_invalid", "Email must be a valid email address")


def has_meaningful_resume_content(
    profile: ResumeProfile,
    *,
    custom_sections: Sequence[BuilderCustomSection] | None = None,
) -> bool:
    if isinstance(profile.summary, str) and profile.summary.strip():
        return True
    if any(group.label.strip() or any(item.strip() for item in group.items) for group in profile.skills):
        return True
    if any(
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
    ):
        return True
    if any(
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
    ):
        return True
    if any(
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
    ):
        return True
    if any(
        any(isinstance(value, str) and value.strip() for value in [item.title, item.description, item.date])
        for item in profile.achievements
    ):
        return True
    if any(
        any(isinstance(value, str) and value.strip() for value in [item.title, item.venue, item.year, item.link])
        for item in profile.publications
    ):
        return True
    if custom_sections:
        for section in custom_sections:
            if (section.title or "").strip() or (section.content or "").strip():
                return True
    return False


def validate_publish_profile(
    profile: ResumeProfile,
    *,
    custom_sections: Sequence[BuilderCustomSection] | None = None,
) -> None:
    validate_identity_fields(profile)
    if not has_meaningful_resume_content(profile, custom_sections=custom_sections):
        raise BuilderValidationError(
            "content_empty_resume",
            "Add at least one meaningful section beyond identity before publishing.",
        )


def validate_draft_name(name: str) -> str:
    trimmed = (name or "").strip()
    if not trimmed:
        raise ValueError("Draft name is required")
    if len(trimmed) > 120:
        raise ValueError("Draft name must be 120 characters or fewer")
    return trimmed

