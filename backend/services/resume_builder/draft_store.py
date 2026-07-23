from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from firebase_admin import firestore

from firebase_config import db
from models.resume import ResumeProfile
from services.resume.profile_normalizer import profile_snapshot_dict
from services.resume_builder.draft_names import next_resume_draft_name
from services.resume_builder.layout_from_profile import derive_layout_from_profile
from services.resume_builder.models import (
    CreateDraftRequest,
    DraftPatchRequest,
    DraftUpdateRequest,
    ResumeBuilderDraft,
    default_section_layout,
)

COLLECTION_NAME = "resume_builder_drafts"


def _collection(uid: str):
    return db.collection("users").document(uid).collection(COLLECTION_NAME)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _default_profile() -> ResumeProfile:
    return ResumeProfile.model_validate({"name": "", "contact": {"email": ""}})


def _hydrate(doc_id: str, uid: str, data: dict) -> ResumeBuilderDraft:
    payload = dict(data)
    payload["id"] = doc_id
    payload["user_id"] = uid
    if not str(payload.get("name") or "").strip():
        profile_name = ""
        profile = payload.get("profile") or {}
        if isinstance(profile, dict) and isinstance(profile.get("name"), str):
            profile_name = profile["name"].strip()
        payload["name"] = profile_name or "Resume(1)"
    return ResumeBuilderDraft.model_validate(payload)


async def create_draft(
    uid: str,
    request: CreateDraftRequest,
    *,
    source_profile: Optional[dict] = None,
) -> ResumeBuilderDraft:
    def _create() -> ResumeBuilderDraft:
        draft_id = f"draft_{uuid.uuid4().hex[:12]}"
        now = _now()
        existing_names = [
            str((snap.to_dict() or {}).get("name") or "").strip()
            for snap in _collection(uid).stream()
        ]
        draft_name = next_resume_draft_name(existing_names)
        profile_payload = source_profile or (
            request.profile.model_dump() if request.profile is not None else _default_profile().model_dump()
        )
        profile = ResumeProfile.model_validate(profile_snapshot_dict(profile_payload))
        if source_profile is not None:
            section_layout, custom_sections, profile = derive_layout_from_profile(profile)
        else:
            section_layout = default_section_layout()
            custom_sections = []

        source_kind = "vault_fork" if request.resume_id else "blank"
        payload = {
            "name": draft_name,
            "created_at": now,
            "updated_at": now,
            "template_id": request.template_id,
            "template_version": "1.0.0",
            "profile": profile_snapshot_dict(profile.model_dump()),
            "section_layout": [section.model_dump() for section in section_layout],
            "custom_sections": [section.model_dump() for section in custom_sections],
            "target_resume_id": request.resume_id,
            "source_resume_id": request.resume_id,
            "source_version_id": request.version_id,
            "source_kind": source_kind,
            "status": "draft",
        }
        _collection(uid).document(draft_id).set(payload)
        return _hydrate(draft_id, uid, payload)

    return await asyncio.to_thread(_create)


async def get_draft(uid: str, draft_id: str) -> Optional[ResumeBuilderDraft]:
    def _get() -> Optional[ResumeBuilderDraft]:
        snap = _collection(uid).document(draft_id).get()
        if not snap.exists:
            return None
        return _hydrate(snap.id, uid, snap.to_dict() or {})

    return await asyncio.to_thread(_get)


async def list_drafts(uid: str) -> list[ResumeBuilderDraft]:
    def _list() -> list[ResumeBuilderDraft]:
        snaps = (
            _collection(uid)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
            .stream()
        )
        return [_hydrate(snap.id, uid, snap.to_dict() or {}) for snap in snaps]

    return await asyncio.to_thread(_list)


async def save_draft(uid: str, draft_id: str, request: DraftUpdateRequest) -> ResumeBuilderDraft:
    def _save() -> ResumeBuilderDraft:
        doc = _collection(uid).document(draft_id)
        snap = doc.get()
        if not snap.exists:
            raise ValueError("draft_not_found")
        current = snap.to_dict() or {}
        payload = {
            **current,
            "updated_at": _now(),
            "name": (request.name or "").strip(),
            "profile": profile_snapshot_dict(request.profile.model_dump()),
            "section_layout": [section.model_dump() for section in request.section_layout],
            "custom_sections": [section.model_dump() for section in request.custom_sections],
            "target_resume_id": request.target_resume_id,
        }
        doc.set(payload, merge=True)
        return _hydrate(draft_id, uid, payload)

    return await asyncio.to_thread(_save)


async def patch_draft(
    uid: str,
    draft_id: str,
    request: DraftPatchRequest,
    *,
    template_version: Optional[str] = None,
) -> ResumeBuilderDraft:
    current = await get_draft(uid, draft_id)
    if current is None:
        raise ValueError("draft_not_found")

    has_content_patch = any(
        field is not None
        for field in (
            request.name,
            request.profile,
            request.section_layout,
            request.custom_sections,
            request.target_resume_id,
        )
    )

    if has_content_patch:
        update_request = DraftUpdateRequest(
            name=request.name if request.name is not None else current.name,
            profile=request.profile or current.profile,
            section_layout=request.section_layout or current.section_layout,
            custom_sections=(
                request.custom_sections if request.custom_sections is not None else current.custom_sections
            ),
            target_resume_id=(
                request.target_resume_id if request.target_resume_id is not None else current.target_resume_id
            ),
        )
        draft = await save_draft(uid, draft_id, update_request)
    else:
        draft = current

    if request.template_id is None:
        return draft

    if template_version is None:
        raise ValueError("template_version_required")

    def _patch_template() -> ResumeBuilderDraft:
        doc = _collection(uid).document(draft_id)
        snap = doc.get()
        if not snap.exists:
            raise ValueError("draft_not_found")
        payload = {
            **(snap.to_dict() or {}),
            "updated_at": _now(),
            "template_id": request.template_id,
            "template_version": template_version,
        }
        doc.set(payload, merge=True)
        return _hydrate(draft_id, uid, payload)

    return await asyncio.to_thread(_patch_template)


async def duplicate_draft(uid: str, draft_id: str) -> ResumeBuilderDraft:
    source = await get_draft(uid, draft_id)
    if source is None:
        raise ValueError("draft_not_found")

    def _duplicate() -> ResumeBuilderDraft:
        new_id = f"draft_{uuid.uuid4().hex[:12]}"
        now = _now()
        existing_names = [
            str((snap.to_dict() or {}).get("name") or "").strip()
            for snap in _collection(uid).stream()
        ]
        draft_name = next_resume_draft_name(existing_names)
        payload = {
            "name": draft_name,
            "created_at": now,
            "updated_at": now,
            "template_id": source.template_id,
            "template_version": source.template_version,
            "profile": profile_snapshot_dict(source.profile.model_dump()),
            "section_layout": [section.model_dump() for section in source.section_layout],
            "custom_sections": [section.model_dump() for section in source.custom_sections],
            "target_resume_id": None,
            "source_resume_id": source.source_resume_id,
            "source_version_id": source.source_version_id,
            "source_kind": source.source_kind or ("vault_fork" if source.source_resume_id else "blank"),
            "status": "draft",
        }
        _collection(uid).document(new_id).set(payload)
        return _hydrate(new_id, uid, payload)

    return await asyncio.to_thread(_duplicate)


async def delete_draft(uid: str, draft_id: str) -> bool:
    def _delete() -> bool:
        doc = _collection(uid).document(draft_id)
        snap = doc.get()
        if not snap.exists:
            return False
        doc.delete()
        return True

    return await asyncio.to_thread(_delete)

