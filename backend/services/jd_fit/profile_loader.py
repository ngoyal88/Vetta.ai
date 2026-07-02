"""Load resume profile snapshot from Vault for JD Fit compute."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException

from services.vault.vault_service import get_vault_entry, get_vault_meta, get_version_by_id


async def load_resume_snapshot(
    uid: str,
    resume_id: Optional[str] = None,
    version_id: Optional[str] = None,
) -> Tuple[Dict[str, Any], Optional[str], Optional[str]]:
    selected_resume_id = (resume_id or "").strip() or None
    selected_version_id = (version_id or "").strip() or None

    if selected_resume_id and not selected_version_id:
        entry = await get_vault_entry(uid, selected_resume_id)
        if not entry:
            return {}, None, None
        selected_version_id = entry.get("current_version_id")
    elif not selected_resume_id:
        meta = await get_vault_meta(uid)
        active_resume_id = meta.get("active_resume_id")
        if active_resume_id:
            entry = await get_vault_entry(uid, active_resume_id)
            if entry:
                selected_resume_id = active_resume_id
                selected_version_id = entry.get("current_version_id")

    if not selected_version_id:
        return {}, selected_resume_id, None

    version = await get_version_by_id(uid, selected_version_id)
    if not version:
        return {}, selected_resume_id, None

    version_resume_id = version.get("resume_id")
    if selected_resume_id and version_resume_id and selected_resume_id != version_resume_id:
        raise HTTPException(
            409,
            detail={
                "code": "version_resume_mismatch",
                "message": "version_id does not belong to resume_id",
            },
        )

    resume_profile = version.get("profile_snapshot")
    if not isinstance(resume_profile, dict):
        resume_profile = {}

    if not selected_resume_id:
        selected_resume_id = version_resume_id

    return resume_profile, selected_resume_id, selected_version_id
