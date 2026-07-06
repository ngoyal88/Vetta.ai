from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from services.resume_builder.models import TemplateMetadata


def templates_root() -> Path:
    return Path(__file__).resolve().parents[2] / "templates" / "resume"


def template_dir(template_id: str) -> Path:
    normalized = (template_id or "").strip()
    if not normalized or "/" in normalized or "\\" in normalized or ".." in normalized:
        raise ValueError("invalid_template_id")
    return templates_root() / normalized


@lru_cache(maxsize=1)
def list_templates() -> list[TemplateMetadata]:
    root = templates_root()
    templates: list[TemplateMetadata] = []
    if not root.exists():
        return templates

    for path in sorted(root.iterdir()):
        metadata_path = path / "metadata.json"
        if not path.is_dir() or not metadata_path.exists():
            continue
        payload = json.loads(metadata_path.read_text(encoding="utf-8"))
        templates.append(TemplateMetadata.model_validate(payload))
    return templates


def get_template(template_id: str) -> TemplateMetadata:
    for template in list_templates():
        if template.id == template_id:
            return template
    raise ValueError("template_not_found")


def template_preview_file(template_id: str) -> Path | None:
    try:
        template = get_template(template_id)
    except ValueError:
        return None
    asset = (template.preview_asset or "").strip()
    if not asset:
        return None
    path = (template_dir(template_id) / asset).resolve()
    root = template_dir(template_id).resolve()
    if not str(path).startswith(str(root)):
        return None
    return path if path.is_file() else None


def clear_template_cache() -> None:
    list_templates.cache_clear()

