"""Build visible resume and verified memory evidence chunks for JD Fit."""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List

from services.jd_fit.jd_fit_models import EvidenceChunk
from services.resume.profile_normalizer import profile_snapshot_dict
from services.resume.skills_normalizer import normalize_skills_input

MAX_CHUNK_TEXT = 700
MAX_RAW_CHUNKS = 30
MIN_STRUCTURED_CHUNKS = 6


def _clean(value: Any, limit: int = MAX_CHUNK_TEXT) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit]


def _append_chunk(
    chunks: List[EvidenceChunk],
    *,
    chunk_id: str,
    source: str,
    section: str,
    text: Any,
    label: str = "",
    visible_on_resume: bool = True,
    verified: bool = False,
) -> None:
    cleaned = _clean(text)
    if len(cleaned) < 3:
        return
    chunks.append(
        EvidenceChunk(
            id=chunk_id,
            source=source,  # type: ignore[arg-type]
            section=section,
            label=_clean(label, 120),
            text=cleaned,
            visible_on_resume=visible_on_resume,
            verified=verified,
        )
    )


def _iter_memory_claims(profile_memory: Dict[str, Any]) -> Iterable[tuple[str, Dict[str, Any]]]:
    for bucket in ("technical", "experience", "behavioral"):
        for entry in profile_memory.get(bucket) or []:
            if isinstance(entry, dict):
                yield bucket, entry


def build_resume_evidence_chunks(profile: Dict[str, Any]) -> List[EvidenceChunk]:
    canonical = profile_snapshot_dict(profile) if isinstance(profile, dict) else {}
    chunks: List[EvidenceChunk] = []

    _append_chunk(chunks, chunk_id="resume_summary", source="resume", section="summary", text=canonical.get("summary"))

    contact_location = canonical.get("contact", {}).get("location") if isinstance(canonical.get("contact"), dict) else None
    if contact_location:
        _append_chunk(chunks, chunk_id="resume_location", source="resume", section="contact", text=contact_location, label="Location")

    for group_index, group in enumerate(normalize_skills_input(canonical.get("skills"))):
        if group.items:
            _append_chunk(
                chunks,
                chunk_id=f"resume_skills_{group_index + 1}",
                source="resume",
                section="skills",
                label=group.label,
                text=", ".join(group.items),
            )

    for exp_index, exp in enumerate(canonical.get("work_experience") or []):
        if not isinstance(exp, dict):
            continue
        role_label = " / ".join(
            part for part in [_clean(exp.get("title"), 90), _clean(exp.get("company"), 90)] if part
        )
        dates = " - ".join(part for part in [_clean(exp.get("start_date"), 30), _clean(exp.get("end_date"), 30)] if part)
        header = " | ".join(part for part in [role_label, dates, _clean(exp.get("location"), 80)] if part)
        _append_chunk(
            chunks,
            chunk_id=f"resume_work_{exp_index + 1}_header",
            source="resume",
            section="work_experience",
            label=role_label,
            text=header,
        )
        for bullet_index, bullet in enumerate((exp.get("responsibilities") or []) + (exp.get("impact") or [])):
            _append_chunk(
                chunks,
                chunk_id=f"resume_work_{exp_index + 1}_bullet_{bullet_index + 1}",
                source="resume",
                section="work_experience",
                label=role_label,
                text=bullet,
            )
        tech_stack = exp.get("tech_stack") or []
        if isinstance(tech_stack, list) and tech_stack:
            _append_chunk(
                chunks,
                chunk_id=f"resume_work_{exp_index + 1}_tech",
                source="resume",
                section="work_experience",
                label=role_label,
                text=", ".join(str(item) for item in tech_stack if item),
            )

    for project_index, project in enumerate(canonical.get("projects") or []):
        if not isinstance(project, dict):
            continue
        name = _clean(project.get("name") or project.get("title"), 120)
        text_parts = [
            name,
            _clean(project.get("description") or project.get("summary")),
            ", ".join(str(item) for item in (project.get("tech_stack") or []) if item),
        ]
        _append_chunk(
            chunks,
            chunk_id=f"resume_project_{project_index + 1}",
            source="resume",
            section="projects",
            label=name,
            text=". ".join(part for part in text_parts if part),
        )

    for edu_index, edu in enumerate(canonical.get("education") or []):
        if not isinstance(edu, dict):
            continue
        fields = ("institution", "degree", "field", "minor", "cgpa", "location", "start_date", "end_date")
        _append_chunk(
            chunks,
            chunk_id=f"resume_education_{edu_index + 1}",
            source="resume",
            section="education",
            text=", ".join(_clean(edu.get(field), 120) for field in fields if _clean(edu.get(field), 120)),
        )

    for ach_index, achievement in enumerate(canonical.get("achievements") or []):
        if isinstance(achievement, dict):
            _append_chunk(
                chunks,
                chunk_id=f"resume_achievement_{ach_index + 1}",
                source="resume",
                section="achievements",
                label=achievement.get("title") or "",
                text=": ".join(
                    part for part in [_clean(achievement.get("title"), 120), _clean(achievement.get("description"))] if part
                ),
            )

    for pub_index, publication in enumerate(canonical.get("publications") or []):
        if not isinstance(publication, dict):
            continue
        title = _clean(publication.get("title"), 120)
        text_parts = [
            title,
            _clean(publication.get("venue")),
            _clean(publication.get("date")),
            _clean(publication.get("description")),
        ]
        _append_chunk(
            chunks,
            chunk_id=f"resume_publication_{pub_index + 1}",
            source="resume",
            section="publications",
            label=title,
            text=". ".join(part for part in text_parts if part),
        )

    for section_index, section in enumerate(canonical.get("custom_sections") or []):
        if not isinstance(section, dict):
            continue
        title = _clean(section.get("title"), 120)
        lines = section.get("lines") or []
        if isinstance(lines, list) and lines:
            _append_chunk(
                chunks,
                chunk_id=f"resume_custom_{section_index + 1}",
                source="resume",
                section="custom_sections",
                label=title,
                text=" | ".join(_clean(line, 240) for line in lines if _clean(line, 240)),
            )

    raw_text = canonical.get("raw_text")
    structured_count = len(chunks)
    if isinstance(raw_text, str) and raw_text.strip():
        paragraphs = [part.strip() for part in re.split(r"\n{2,}|(?<=\.)\s+(?=[A-Z])", raw_text) if part.strip()]
        raw_limit = MAX_RAW_CHUNKS if structured_count < MIN_STRUCTURED_CHUNKS else min(MAX_RAW_CHUNKS, 12)
        for raw_index, paragraph in enumerate(paragraphs[:raw_limit]):
            _append_chunk(
                chunks,
                chunk_id=f"resume_raw_{raw_index + 1}",
                source="resume",
                section="raw_text",
                text=paragraph,
            )

    return chunks


def build_memory_evidence_chunks(profile_memory: Dict[str, Any]) -> List[EvidenceChunk]:
    chunks: List[EvidenceChunk] = []
    for index, (bucket, claim) in enumerate(_iter_memory_claims(profile_memory), start=1):
        text = claim.get("evidence_quote") or claim.get("claim_text") or claim.get("normalized_key")
        label = claim.get("normalized_key") or claim.get("claim_text") or bucket
        _append_chunk(
            chunks,
            chunk_id=f"vpm_{bucket}_{index}",
            source="profile_memory",
            section=bucket,
            label=label,
            text=text,
            visible_on_resume=False,
            verified=True,
        )
    return chunks


def build_evidence_chunks(profile: Dict[str, Any], profile_memory: Dict[str, Any]) -> List[EvidenceChunk]:
    return [*build_resume_evidence_chunks(profile), *build_memory_evidence_chunks(profile_memory)]
