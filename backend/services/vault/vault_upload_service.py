"""Vault upload orchestration — parse, version, scorecard."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException, UploadFile

from services.resume.profile_normalizer import profile_snapshot_dict
from services.resume.resume_parser import parse_resume_llm
from services.vault import (
    MAX_RESUMES_PER_USER,
    MAX_VERSIONS_PER_RESUME,
    add_version,
    create_resume_entry,
    delete_resume_entry,
    get_vault_entry,
    get_vault_meta,
)
from utils.http_errors import raise_service_error
from utils.logger import get_logger

logger = get_logger(__name__)


async def rollback_created_entry(uid: str, resume_id: str) -> None:
    try:
        await delete_resume_entry(uid, resume_id)
    except Exception:
        logger.exception("Vault rollback failed for uid=%s resume_id=%s", uid, resume_id)


async def upload_resume_to_vault(
    *,
    uid: str,
    file: UploadFile,
    name: str,
    tags_list: list[str],
    resume_id: Optional[str],
    user_note: str,
    role: Optional[str],
    max_size_bytes: int,
) -> dict[str, Any]:
    blob = await file.read(max_size_bytes + 1)
    if len(blob) > max_size_bytes:
        raise HTTPException(413, "File too large. Max size 5 MB.")
    if not blob:
        raise HTTPException(400, "empty file")

    meta = await get_vault_meta(uid)
    resume_count = int(meta.get("resume_count", 0) or 0)
    active_resume_id = meta.get("active_resume_id")
    created_new_entry = False
    normalized_resume_id = resume_id

    if not normalized_resume_id:
        if resume_count >= MAX_RESUMES_PER_USER:
            raise HTTPException(403, f"Resume limit reached (max {MAX_RESUMES_PER_USER}).")
        try:
            entry = await create_resume_entry(
                uid,
                name,
                tags_list,
                active_resume_id is None,
            )
        except ValueError as exc:
            if str(exc) == "resume_limit_reached":
                raise HTTPException(403, f"Resume limit reached (max {MAX_RESUMES_PER_USER}).") from exc
            raise
        normalized_resume_id = entry["id"]
        created_new_entry = True
    else:
        entry = await get_vault_entry(uid, normalized_resume_id)
        if not entry:
            raise HTTPException(404, "Resume entry not found")

    try:
        parsed = await parse_resume_llm(blob, file.filename, uid, persist=False)
    except ValueError as exc:
        if created_new_entry and normalized_resume_id:
            await rollback_created_entry(uid, normalized_resume_id)
        logger.warning(
            "Vault resume parse rejected for uid=%s filename=%s error=%s",
            uid,
            file.filename,
            exc,
        )
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        if created_new_entry and normalized_resume_id:
            await rollback_created_entry(uid, normalized_resume_id)
        raise_service_error(
            logger,
            exc,
            message="Resume parsing failed. Please try again.",
            log_event=f"Vault resume parse failed uid={uid} file={file.filename}",
        )

    try:
        version, scorecard = await add_version(
            uid,
            normalized_resume_id,
            profile_snapshot_dict(parsed.profile.model_dump()),
            user_note,
            role=role,
            source_filename=file.filename,
            source_blob=blob,
            content_type=file.content_type,
        )
    except ValueError as exc:
        if created_new_entry and normalized_resume_id:
            await rollback_created_entry(uid, normalized_resume_id)
        if str(exc) == "version_limit_reached":
            raise HTTPException(403, f"Version limit reached (max {MAX_VERSIONS_PER_RESUME}).") from exc
        if str(exc) == "resume_not_found":
            raise HTTPException(404, "Resume entry not found") from exc
        raise HTTPException(400, "Failed to create version") from exc
    except Exception as exc:
        if created_new_entry and normalized_resume_id:
            await rollback_created_entry(uid, normalized_resume_id)
        raise_service_error(
            logger,
            exc,
            message="Failed to create resume version. Please try again.",
            log_event=f"Vault version creation failed uid={uid} resume_id={normalized_resume_id}",
        )

    entry = await get_vault_entry(uid, normalized_resume_id)
    return {"entry": entry, "version": version, "scorecard": scorecard.model_dump()}
