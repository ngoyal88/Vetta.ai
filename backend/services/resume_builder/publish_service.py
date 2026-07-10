from __future__ import annotations

import hashlib

from services.resume_builder.compile_client import compile_preview
from services.resume_builder.draft_store import delete_draft, get_draft
from services.resume_builder.models import (
    PublishDraftRequest,
    PublishDraftResponse,
    default_resume_name,
    validate_publish_profile,
)
from services.resume_builder.template_renderer import render_template
from services.vault.vault_service import (
    add_version,
    create_resume_entry,
    delete_resume_entry,
    get_vault_entry,
    set_active_resume,
)
from utils.logger import get_logger

log = get_logger(__name__)

_BUILDER_SOURCE_FILENAME = "resume-builder.pdf"
_BUILDER_CONTENT_TYPE = "application/pdf"


async def _rollback_created_entry(uid: str, resume_id: str) -> None:
    try:
        await delete_resume_entry(uid, resume_id)
    except Exception:
        log.exception("Resume Builder publish rollback failed uid=%s resume_id=%s", uid, resume_id)


def _builder_metadata(tex: str, draft) -> dict[str, object]:
    return {
        "template_id": draft.template_id,
        "template_version": draft.template_version,
        "rendered_tex_hash": f"sha256:{hashlib.sha256(tex.encode('utf-8')).hexdigest()}",
        "section_layout": [section.model_dump() for section in draft.section_layout],
    }


async def publish_draft(uid: str, draft_id: str, request: PublishDraftRequest) -> PublishDraftResponse:
    draft = await get_draft(uid, draft_id)
    if not draft:
        raise ValueError("draft_not_found")

    validate_publish_profile(draft.profile, custom_sections=draft.custom_sections)
    tex = render_template(draft.template_id, draft)
    pdf_bytes, _page_count = await compile_preview(tex)

    target_resume_id = request.target_resume_id or draft.target_resume_id
    if target_resume_id:
        entry = await get_vault_entry(uid, target_resume_id)
        if not entry:
            raise ValueError("resume_not_found")
        resume_id = target_resume_id
        created_new_entry = False
    else:
        resume_name = (request.resume_name or "").strip() or default_resume_name(draft.profile)
        entry = await create_resume_entry(
            uid,
            resume_name,
            request.tags,
            request.set_active,
            origin="builder",
        )
        resume_id = str(entry["id"])
        created_new_entry = True

    try:
        version, scorecard = await add_version(
            uid,
            resume_id,
            draft.profile.model_dump(),
            request.user_note.strip(),
            source_filename=_BUILDER_SOURCE_FILENAME,
            source_blob=pdf_bytes,
            content_type=_BUILDER_CONTENT_TYPE,
            action="builder_publish",
            builder_metadata=_builder_metadata(tex, draft),
        )
    except Exception:
        if created_new_entry:
            await _rollback_created_entry(uid, resume_id)
        raise

    if request.set_active:
        await set_active_resume(uid, resume_id)

    await delete_draft(uid, draft_id)

    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise ValueError("resume_not_found")

    return PublishDraftResponse(
        resume_id=resume_id,
        version_id=str(version["id"]),
        entry=entry,
        version=version,
        scorecard=scorecard.model_dump(),
    )

