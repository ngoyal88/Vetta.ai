"""Resume snapshot loading from vault — shared by interview start and builder."""
from __future__ import annotations

from typing import Any

from services.vault.vault_service import get_vault_entry, get_vault_meta, get_version_by_id
from utils.logger import get_logger

logger = get_logger(__name__)


async def load_active_resume_snapshot(uid: str) -> dict[str, Any]:
    """Return profile_snapshot dict for user's active vault resume, or {}."""
    try:
        meta = await get_vault_meta(uid)
        active_id = meta.get("active_resume_id")
        if not active_id:
            return {}
        entry = await get_vault_entry(uid, active_id)
        if not entry:
            return {}
        version_id = entry.get("current_version_id")
        if not version_id:
            return {}
        version = await get_version_by_id(uid, version_id)
        if not version:
            return {}
        profile = version.get("profile_snapshot")
        return profile if isinstance(profile, dict) else {}
    except Exception as e:
        logger.warning("Failed to load vault resume for %s: %s", uid, e)
        return {}
