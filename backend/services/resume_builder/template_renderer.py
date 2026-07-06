from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from services.resume_builder.latex_escape import latex_escape
from services.resume_builder.models import ResumeBuilderDraft
from services.resume_builder.template_catalog import get_template, templates_root


def _build_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(templates_root())),
        autoescape=False,
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        variable_start_string="<<",
        variable_end_string=">>",
        block_start_string="<%",
        block_end_string="%>",
        comment_start_string="<#",
        comment_end_string="#>",
    )
    env.filters["latex"] = latex_escape
    env.filters["trim"] = lambda value: str(value).strip() if value is not None else ""
    return env


def _layout_sections(draft: ResumeBuilderDraft) -> list[dict[str, Any]]:
    custom_lookup = {section.id: section for section in draft.custom_sections}
    sections: list[dict[str, Any]] = []
    for section in draft.section_layout:
        if not section.enabled or section.kind == "identity":
            continue
        entry: dict[str, Any] = {
            "id": section.id,
            "kind": section.kind,
            "label": section.label.strip() or section.kind.replace("_", " ").title(),
        }
        if section.kind == "custom":
            custom = custom_lookup.get(section.id)
            if custom and custom.content:
                entry["custom_lines"] = [
                    line.strip() for line in custom.content.splitlines() if line.strip()
                ]
        sections.append(entry)
    return sections


def render_template(template_id: str, draft: ResumeBuilderDraft) -> str:
    metadata = get_template(template_id)
    template_path = Path(metadata.id) / "template.tex"
    env = _build_env()
    template = env.get_template(str(template_path).replace("\\", "/"))
    return template.render(
        template=metadata.model_dump(),
        profile=draft.profile.model_dump(),
        layout=_layout_sections(draft),
    )
