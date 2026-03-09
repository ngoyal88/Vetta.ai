from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any


# ------- Legacy Affinda-style models (kept for backwards compatibility) ------- #

class PersonName(BaseModel):
    raw: str = ""
    first: str = ""
    last: str = ""


class Skill(BaseModel):
    name: str


class WorkExperience(BaseModel):
    jobTitle: str = ""
    organization: str = ""
    dates: str = ""
    jobDescription: str = ""


class EducationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    dates: str = ""


class Project(BaseModel):
    name: str
    description: str = ""
    technologies: List[str] = []


class ResumeData(BaseModel):
    name: PersonName = PersonName()
    phoneNumbers: List[str] = Field(default_factory=list)
    emails: List[str] = Field(default_factory=list)
    skills: List[Skill] = Field(default_factory=list)
    workExperience: List[WorkExperience] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    rawText: str = ""


class ResumeResponse(BaseModel):
    data: ResumeData
    meta: dict


# ------- LLM-structured resume models (new) ------- #

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


class SkillsByCategory(BaseModel):
    languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)
    cloud: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    ml_ai: List[str] = Field(default_factory=list)
    other: List[str] = Field(default_factory=list)


class EducationRecord(BaseModel):
    degree: Optional[str] = None
    field: Optional[str] = None
    institution: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    cgpa: Optional[str] = None
    location: Optional[str] = None


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

    skills: SkillsByCategory = SkillsByCategory()
    education: List[EducationRecord] = Field(default_factory=list)
    work_experience: List[WorkExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)

    achievements: List[AchievementItem] = Field(default_factory=list)
    publications: List[PublicationItem] = Field(default_factory=list)

    weak_areas: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = None


class ParsedResumeResponse(BaseModel):
    profile: ResumeProfile
    meta: Dict[str, Any]
