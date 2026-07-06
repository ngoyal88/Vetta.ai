from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional, Literal, Dict, Any

_MAX_SKILL_GROUPS = 25
_MAX_SKILL_ITEMS_PER_GROUP = 40
_MAX_SKILL_LABEL_LEN = 80
_MAX_SKILL_ITEM_LEN = 120
_MAX_EDUCATION_HIGHLIGHTS = 12
_MAX_HIGHLIGHT_LABEL_LEN = 80
_MAX_HIGHLIGHT_TEXT_LEN = 500


class ContactLinks(BaseModel):
    github: Optional[str] = None
    linkedin: Optional[str] = None
    portfolio: Optional[str] = None
    other: List[str] = Field(default_factory=list)


class ContactInfo(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    links: ContactLinks = ContactLinks()


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


class ProjectItem(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    role: Optional[str] = None
    scale: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    link: Optional[str] = None


class AchievementItem(BaseModel):
    title: str
    description: Optional[str] = None
    date: Optional[str] = None


class PublicationItem(BaseModel):
    title: str
    venue: Optional[str] = None
    year: Optional[str] = None
    link: Optional[str] = None


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
