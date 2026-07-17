from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional, Literal, Dict, Any

_MAX_SKILL_GROUPS = 25
_MAX_SKILL_ITEMS_PER_GROUP = 40
_MAX_SKILL_LABEL_LEN = 80
_MAX_SKILL_ITEM_LEN = 120
_MAX_EDUCATION_HIGHLIGHTS = 12
_MAX_HIGHLIGHT_LABEL_LEN = 80
_MAX_HIGHLIGHT_TEXT_LEN = 500


def _sanitize_optional_contact_url(value: Any, *, other: bool = False) -> Optional[str]:
    from services.resume.contact_validators import sanitize_optional_contact_url

    return sanitize_optional_contact_url(value, other=other)


class ContactLinks(BaseModel):
    github: Optional[str] = None
    linkedin: Optional[str] = None
    portfolio: Optional[str] = None
    other: List[str] = Field(default_factory=list)

    @field_validator("github", "linkedin", "portfolio", mode="before")
    @classmethod
    def _validate_profile_urls(cls, value: Any) -> Optional[str]:
        return _sanitize_optional_contact_url(value)

    @field_validator("other", mode="before")
    @classmethod
    def _validate_other_urls(cls, value: Any) -> List[str]:
        if not value:
            return []
        items = value if isinstance(value, list) else [value]
        cleaned: List[str] = []
        seen: set[str] = set()
        for item in items:
            normalized = _sanitize_optional_contact_url(item, other=True)
            if not normalized:
                continue
            key = normalized.lower().rstrip("/")
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(normalized)
        return cleaned


class ContactInfo(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    links: ContactLinks = ContactLinks()

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        if text.lower().startswith("mailto:"):
            text = text[7:].strip()
        return text or None


class SkillGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: str = Field(default="", max_length=_MAX_SKILL_LABEL_LEN)
    items: List[str] = Field(default_factory=list)


class EducationHighlight(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: str = Field(default="", max_length=_MAX_HIGHLIGHT_LABEL_LEN)
    text: str = Field(default="", max_length=_MAX_HIGHLIGHT_TEXT_LEN)


class EducationRecord(BaseModel):
    degree: Optional[str] = None
    field: Optional[str] = None
    minor: Optional[str] = None
    institution: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    cgpa: Optional[str] = None
    location: Optional[str] = None
    highlights: List[EducationHighlight] = Field(default_factory=list)

    @field_validator("highlights", mode="after")
    @classmethod
    def _drop_empty_highlights(cls, value: List[EducationHighlight]) -> List[EducationHighlight]:
        return [
            highlight
            for highlight in value[:_MAX_EDUCATION_HIGHLIGHTS]
            if highlight.label.strip() and highlight.text.strip()
        ]


class WorkExperienceItem(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    employment_type: Optional[str] = None
    responsibilities: List[str] = Field(default_factory=list)
    tech_stack: List[str] = Field(default_factory=list)
    impact: List[str] = Field(default_factory=list)

    @field_validator("responsibilities", "tech_stack", "impact", mode="before")
    @classmethod
    def _coerce_null_list_fields(cls, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        return []


class ProjectItem(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    role: Optional[str] = None
    scale: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    link: Optional[str] = None

    @field_validator("description", mode="before")
    @classmethod
    def _coerce_description(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, list):
            lines = [str(item).strip() for item in value if str(item).strip()]
            return "\n".join(lines) or None
        if isinstance(value, str):
            return value
        return str(value)

    @field_validator("link", mode="before")
    @classmethod
    def _validate_project_link(cls, value: Any) -> Optional[str]:
        return _sanitize_optional_contact_url(value)


class AchievementItem(BaseModel):
    title: str
    description: Optional[str] = None
    date: Optional[str] = None

    @field_validator("title", mode="before")
    @classmethod
    def _coerce_title(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()


class PublicationItem(BaseModel):
    title: str
    venue: Optional[str] = None
    year: Optional[str] = None
    link: Optional[str] = None

    @field_validator("title", mode="before")
    @classmethod
    def _coerce_title(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()


_MAX_CUSTOM_SECTIONS = 10
_MAX_CUSTOM_SECTION_LINES = 40
_MAX_CUSTOM_SECTION_TITLE_LEN = 80
_MAX_CUSTOM_SECTION_LINE_LEN = 500


class CustomSectionItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field(max_length=_MAX_CUSTOM_SECTION_TITLE_LEN)
    lines: List[str] = Field(default_factory=list)

    @field_validator("lines", mode="after")
    @classmethod
    def _sanitize_lines(cls, value: List[str]) -> List[str]:
        return [
            line.strip()[:_MAX_CUSTOM_SECTION_LINE_LEN]
            for line in value[:_MAX_CUSTOM_SECTION_LINES]
            if isinstance(line, str) and line.strip()
        ]


class ResumeProfile(BaseModel):
    name: Optional[str] = None
    contact: ContactInfo = ContactInfo()
    summary: Optional[str] = None

    years_experience: Optional[float] = None
    seniority_level: Literal["junior", "mid", "senior", "lead", "principal", "unknown"] = "unknown"

    skills: List[SkillGroup] = Field(default_factory=list)
    education: List[EducationRecord] = Field(default_factory=list)
    work_experience: List[WorkExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)

    achievements: List[AchievementItem] = Field(default_factory=list)
    publications: List[PublicationItem] = Field(default_factory=list)
    custom_sections: List[CustomSectionItem] = Field(default_factory=list)

    weak_areas: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = None

    @field_validator("skills", mode="before")
    @classmethod
    def _coerce_skills(cls, value: Any) -> List[SkillGroup]:
        from services.resume.skills_normalizer import normalize_skills_input

        return normalize_skills_input(value)

    @field_validator("skills", mode="after")
    @classmethod
    def _sanitize_skill_groups(cls, value: List[SkillGroup]) -> List[SkillGroup]:
        sanitized: List[SkillGroup] = []
        for group in value[:_MAX_SKILL_GROUPS]:
            label = (group.label or "").strip()[:_MAX_SKILL_LABEL_LEN]
            items = [
                item.strip()[:_MAX_SKILL_ITEM_LEN]
                for item in group.items[:_MAX_SKILL_ITEMS_PER_GROUP]
                if isinstance(item, str) and item.strip()
            ]
            if label or items:
                sanitized.append(SkillGroup(label=label, items=items))
        return sanitized

    @field_validator("achievements", mode="before")
    @classmethod
    def _filter_achievements(cls, value: Any) -> List[Any]:
        if not value:
            return []
        if not isinstance(value, list):
            return []
        kept: List[Any] = []
        for item in value:
            if isinstance(item, str):
                if item.strip():
                    kept.append(item)
                continue
            if isinstance(item, dict):
                title = item.get("title")
                if title is not None and str(title).strip():
                    kept.append(item)
        return kept

    @field_validator("publications", mode="before")
    @classmethod
    def _filter_publications(cls, value: Any) -> List[Any]:
        if not value:
            return []
        if not isinstance(value, list):
            return []
        kept: List[Any] = []
        for item in value:
            if not isinstance(item, dict):
                continue
            title = item.get("title")
            if title is not None and str(title).strip():
                kept.append(item)
        return kept

    @field_validator("achievements", mode="after")
    @classmethod
    def _drop_empty_achievement_titles(cls, value: List[AchievementItem]) -> List[AchievementItem]:
        return [item for item in value if item.title.strip()]

    @field_validator("publications", mode="after")
    @classmethod
    def _drop_empty_publication_titles(cls, value: List[PublicationItem]) -> List[PublicationItem]:
        return [item for item in value if item.title.strip()]

    @field_validator("custom_sections", mode="after")
    @classmethod
    def _sanitize_custom_sections(cls, value: List[CustomSectionItem]) -> List[CustomSectionItem]:
        kept: List[CustomSectionItem] = []
        for section in value[:_MAX_CUSTOM_SECTIONS]:
            title = (section.title or "").strip()[:_MAX_CUSTOM_SECTION_TITLE_LEN]
            lines = [
                line.strip()[:_MAX_CUSTOM_SECTION_LINE_LEN]
                for line in section.lines[:_MAX_CUSTOM_SECTION_LINES]
                if line.strip()
            ]
            if title and lines:
                kept.append(CustomSectionItem(title=title, lines=lines))
        return kept


class ParsedResumeResponse(BaseModel):
    profile: ResumeProfile
    meta: Dict[str, Any]


class ResumeCoverageCounts(BaseModel):
    skills: int = 0
    projects: int = 0
    work_experiences: int = 0


class ResumeScorecardMeta(BaseModel):
    model: str
    version: str
    generated_at: str
    fallback_used: bool = False


class ResumeScorecardResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    coverage_counts: ResumeCoverageCounts
    summary_line: str
    role_hint_text: Optional[str] = None
    suggestions: List[str] = Field(default_factory=list, max_length=3)
    meta: ResumeScorecardMeta
