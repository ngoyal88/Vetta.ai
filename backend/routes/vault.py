import asyncio
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from services.resume.resume_parser import parse_resume_llm
from services.vault import (
    MAX_RESUMES_PER_USER,
    MAX_VERSIONS_PER_RESUME,
    add_version,
    compare_profiles,
    create_resume_entry,
    delete_resume_entry,
    get_vault_entry,
    get_vault_meta,
    get_version_for_resume,
    get_version_by_id,
    list_vault_entries,
    list_versions,
    restore_version,
    set_active_resume,
    update_entry_scorecard,
    update_version_score,
    update_entry,
)
from services.vault.analysis_service import build_vault_scorecard
from services.vault import file_storage
from services.vault.vault_service import normalize_tags, set_vault_meta
from utils.auth import verify_firebase_token
from utils.http_errors import raise_service_error
from utils.logger import get_logger
from utils.rate_limit import check_rate_limit

router = APIRouter(tags=["Vault"])
logger = get_logger(__name__)

MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/plain; charset=utf-8",
}
EDITABLE_ENTRY_FIELDS = {"name", "tags"}


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _allowed_file(filename: Optional[str], content_type: Optional[str]) -> bool:
    if not filename or not filename.strip():
        return False
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return False
    if content_type and content_type.strip():
        base_ct = content_type.split(";")[0].strip().lower()
        allowed_bases = {ct.split(";")[0].strip().lower() for ct in ALLOWED_CONTENT_TYPES}
        if base_ct not in allowed_bases:
            return False
    return True


def _clean_optional_string(value: Any, field_name: str) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        raise HTTPException(400, f"{field_name} must be a string")
    cleaned = value.strip()
    return cleaned or None


def _clean_required_string(value: Any, field_name: str) -> str:
    cleaned = _clean_optional_string(value, field_name)
    if not cleaned:
        raise HTTPException(400, f"{field_name} is required")
    return cleaned


def _normalize_tags_or_400(value: Any, *, allow_string: bool, error_message: str) -> list[str]:
    if value is None:
        return []
    if not allow_string and not isinstance(value, list):
        raise HTTPException(400, error_message)
    try:
        return normalize_tags(value)
    except ValueError as exc:
        if str(exc) == "tags_invalid":
            raise HTTPException(400, error_message) from exc
        raise


def _parse_entry_update_payload(payload: Dict[str, Any]) -> tuple[Optional[str], Optional[list[str]]]:
    unexpected_fields = sorted(set(payload) - EDITABLE_ENTRY_FIELDS)
    if unexpected_fields:
        joined = ", ".join(unexpected_fields)
        raise HTTPException(400, f"Unsupported fields for vault metadata update: {joined}")

    if not payload:
        raise HTTPException(400, "At least one of name or tags is required")

    has_name = "name" in payload
    has_tags = "tags" in payload
    if not has_name and not has_tags:
        raise HTTPException(400, "At least one of name or tags is required")

    name = payload.get("name")
    tags = payload.get("tags")

    if has_name and not isinstance(name, str):
        raise HTTPException(400, "name must be a string")
    normalized_tags = None
    if has_tags:
        normalized_tags = _normalize_tags_or_400(
            tags,
            allow_string=False,
            error_message="tags must be an array of strings",
        )

    return name, normalized_tags


async def _require_linked_version(
    uid: str,
    resume_id: str,
    version_id: str,
    *,
    mismatch_status_code: int = 400,
    mismatch_message: str = "version_id does not belong to resume_id",
) -> Dict[str, Any]:
    version = await get_version_for_resume(uid, resume_id, version_id)
    if version:
        return version

    detached_version = await get_version_by_id(uid, version_id)
    if detached_version:
        raise HTTPException(mismatch_status_code, mismatch_message)

    raise HTTPException(404, "Version not found")


async def _rollback_created_entry(uid: str, resume_id: str) -> None:
    try:
        await delete_resume_entry(uid, resume_id)
    except Exception:
        logger.exception("Vault rollback failed for uid=%s resume_id=%s", uid, resume_id)


@router.get("/vault")
async def list_vault(uid: str = Depends(verify_firebase_token)):
    meta = await get_vault_meta(uid)
    entries = await list_vault_entries(uid)
    return {"entries": entries, "meta": meta}


@router.post("/vault/upload")
async def upload_to_vault(
    file: UploadFile = File(...),
    name: str = Form(...),
    tags: Optional[str] = Form(None),
    resume_id: Optional[str] = Form(None),
    user_note: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "vault_upload", limit=10, window_seconds=60)

    if not _allowed_file(file.filename, file.content_type):
        raise HTTPException(400, "Unsupported file type. Allowed: PDF, DOCX, TXT.")
    blob = await file.read(MAX_RESUME_SIZE_BYTES + 1)
    if len(blob) > MAX_RESUME_SIZE_BYTES:
        raise HTTPException(413, "File too large. Max size 5 MB.")
    if not blob:
        raise HTTPException(400, "empty file")

    normalized_name = _clean_required_string(name, "name")
    normalized_resume_id = _clean_optional_string(resume_id, "resume_id")
    normalized_role = _clean_optional_string(role, "role")
    normalized_user_note = (user_note or "").strip()

    meta = await get_vault_meta(uid)
    resume_count = _coerce_int(meta.get("resume_count", 0))
    active_resume_id = meta.get("active_resume_id")
    created_new_entry = False

    tags_list = _normalize_tags_or_400(
        tags,
        allow_string=True,
        error_message="tags must be a comma-separated string or JSON array of strings",
    )

    if not normalized_resume_id:
        if resume_count >= MAX_RESUMES_PER_USER:
            raise HTTPException(403, f"Resume limit reached (max {MAX_RESUMES_PER_USER}).")
        is_active = active_resume_id is None
        entry = await create_resume_entry(uid, normalized_name, tags_list, is_active)
        normalized_resume_id = entry["id"]
        created_new_entry = True
        resume_count += 1
        if is_active:
            active_resume_id = normalized_resume_id
        await set_vault_meta(uid, resume_count, active_resume_id)
    else:
        entry = await get_vault_entry(uid, normalized_resume_id)
        if not entry:
            raise HTTPException(404, "Resume entry not found")

    try:
        parsed = await parse_resume_llm(blob, file.filename, uid, persist=False)
    except ValueError as exc:
        if created_new_entry and normalized_resume_id:
            await _rollback_created_entry(uid, normalized_resume_id)
        logger.warning(
            "Vault resume parse rejected for uid=%s filename=%s error=%s",
            uid,
            file.filename,
            exc,
        )
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        if created_new_entry and normalized_resume_id:
            await _rollback_created_entry(uid, normalized_resume_id)
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
            parsed.profile.model_dump(),
            normalized_user_note,
            role=normalized_role,
            source_filename=file.filename,
            source_blob=blob,
            content_type=file.content_type,
        )
    except ValueError as exc:
        if created_new_entry and normalized_resume_id:
            await _rollback_created_entry(uid, normalized_resume_id)
        if str(exc) == "version_limit_reached":
            raise HTTPException(403, f"Version limit reached (max {MAX_VERSIONS_PER_RESUME}).") from exc
        if str(exc) == "resume_not_found":
            raise HTTPException(404, "Resume entry not found") from exc
        raise HTTPException(400, "Failed to create version") from exc
    except Exception as exc:
        if created_new_entry and normalized_resume_id:
            await _rollback_created_entry(uid, normalized_resume_id)
        raise_service_error(
            logger,
            exc,
            message="Failed to create resume version. Please try again.",
            log_event=f"Vault version creation failed uid={uid} resume_id={normalized_resume_id}",
        )

    entry = await get_vault_entry(uid, normalized_resume_id)
    return {"entry": entry, "version": version, "scorecard": scorecard.model_dump()}


@router.get("/vault/{resume_id}")
async def get_vault_item(resume_id: str, uid: str = Depends(verify_firebase_token)):
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise HTTPException(404, "Resume entry not found")
    return entry


@router.patch("/vault/{resume_id}")
async def update_vault_item(
    resume_id: str,
    payload: Dict[str, Any],
    uid: str = Depends(verify_firebase_token),
):
    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid request body")

    name, tags = _parse_entry_update_payload(payload)
    try:
        updated = await update_entry(uid, resume_id, name, tags)
    except ValueError as exc:
        if str(exc) == "resume_not_found":
            raise HTTPException(404, "Resume entry not found") from exc
        if str(exc) == "invalid_name":
            raise HTTPException(400, "Resume name cannot be blank.") from exc
        if str(exc) == "tags_invalid":
            raise HTTPException(400, "tags must be an array of strings") from exc
        raise HTTPException(400, "Failed to update resume entry") from exc
    return updated


@router.delete("/vault/{resume_id}")
async def delete_vault_item(resume_id: str, uid: str = Depends(verify_firebase_token)):
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise HTTPException(404, "Resume entry not found")
    await delete_resume_entry(uid, resume_id)
    meta = await get_vault_meta(uid)
    return {
        "status": "deleted",
        "active_resume_id": meta.get("active_resume_id"),
        "resume_count": meta.get("resume_count", 0),
    }


@router.put("/vault/{resume_id}/set-active")
async def set_active(resume_id: str, uid: str = Depends(verify_firebase_token)):
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise HTTPException(404, "Resume entry not found")
    await set_active_resume(uid, resume_id)
    return {"status": "ok"}


@router.get("/versions")
async def get_versions(resume_id: str, uid: str = Depends(verify_firebase_token)):
    if not resume_id:
        raise HTTPException(400, "resume_id is required")
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise HTTPException(404, "Resume entry not found")
    versions = await list_versions(uid, resume_id)
    return {"versions": versions}


@router.get("/versions/{version_id}")
async def get_version(version_id: str, uid: str = Depends(verify_firebase_token)):
    version = await get_version_by_id(uid, version_id)
    if not version:
        raise HTTPException(404, "Version not found")
    return version


@router.get("/vault/files/{version_id}")
async def download_version_file(version_id: str, uid: str = Depends(verify_firebase_token)):
    await check_rate_limit(uid, "vault_file", limit=120, window_seconds=60)

    version = await get_version_by_id(uid, version_id)
    if not version:
        raise HTTPException(404, "Version not found")
    if not version.get("has_source_file"):
        raise HTTPException(404, "No file stored for this version")

    resume_id = version.get("resume_id")
    if not resume_id:
        raise HTTPException(404, "Version not found")

    source_filename = version.get("source_filename")
    try:
        blob = await asyncio.to_thread(
            file_storage.read_version_file,
            uid,
            resume_id,
            version_id,
            source_filename,
            storage_path=version.get("storage_path"),
            storage_backend=version.get("storage_backend"),
        )
    except FileNotFoundError:
        raise HTTPException(404, "Stored file not found") from None
    except RuntimeError as exc:
        logger.warning("Vault file storage unavailable for uid=%s version_id=%s: %s", uid, version_id, exc)
        raise HTTPException(503, "Resume file storage is not available") from exc

    media_type = version.get("content_type") or file_storage.content_type_for_filename(source_filename)
    headers = {}
    if source_filename:
        safe_filename = (
            source_filename.replace('"', "")
            .replace("\r", "")
            .replace("\n", "")
        )
        headers["Content-Disposition"] = f'inline; filename="{safe_filename}"'

    return Response(content=blob, media_type=media_type, headers=headers)


@router.post("/restore/{version_id}")
async def restore(version_id: str, payload: Dict[str, Any], uid: str = Depends(verify_firebase_token)):
    await check_rate_limit(uid, "vault_restore", limit=30, window_seconds=60)

    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid request body")

    role = _clean_optional_string(payload.get("role"), "role")
    try:
        result = await restore_version(uid, version_id, role=role)
    except ValueError as exc:
        logger.warning("Vault restore rejected for uid=%s version_id=%s error=%s", uid, version_id, exc)
        if str(exc) == "version_not_found":
            raise HTTPException(404, "Version not found") from exc
        if str(exc) == "resume_not_found":
            raise HTTPException(404, "Resume entry not found") from exc
        if str(exc) == "version_resume_mismatch":
            raise HTTPException(409, "Version is no longer linked to its resume entry") from exc
        raise HTTPException(400, "Restore failed") from exc
    except Exception as exc:
        logger.exception("Vault restore failed for uid=%s version_id=%s", uid, version_id)
        raise HTTPException(500, "Resume restore failed. Please try again.") from exc
    return result


@router.post("/analyze")
async def analyze(payload: Dict[str, Any], uid: str = Depends(verify_firebase_token)):
    await check_rate_limit(uid, "vault_analyze", limit=20, window_seconds=60)

    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid request body")

    resume_id = _clean_required_string(payload.get("resume_id"), "resume_id")
    version_id = _clean_optional_string(payload.get("version_id"), "version_id")
    role = _clean_optional_string(payload.get("role"), "role")

    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise HTTPException(404, "Resume entry not found")

    if not version_id:
        version_id = entry.get("current_version_id")
    if not version_id:
        raise HTTPException(404, "No version available to analyze")

    try:
        version = await _require_linked_version(uid, resume_id, version_id)
    except HTTPException as exc:
        logger.warning(
            "Vault analyze rejected for uid=%s resume_id=%s version_id=%s status=%s detail=%s",
            uid,
            resume_id,
            version_id,
            exc.status_code,
            exc.detail,
        )
        raise

    profile_snapshot = version.get("profile_snapshot") or {}
    updates_entry_scorecard = version_id == entry.get("current_version_id")
    try:
        scorecard = await build_vault_scorecard(profile_snapshot, role=role)
        await update_version_score(uid, version_id, scorecard.score)
        if updates_entry_scorecard:
            await update_entry_scorecard(
                uid,
                resume_id,
                scorecard,
                version_number=version.get("version_number"),
                version_id=version_id,
                action="reanalyze",
                role=role,
            )
    except ValueError as exc:
        logger.warning(
            "Vault analyze rejected for uid=%s resume_id=%s version_id=%s error=%s",
            uid,
            resume_id,
            version_id,
            exc,
        )
        if str(exc) == "version_not_found":
            raise HTTPException(404, "Version not found") from exc
        if str(exc) == "resume_not_found":
            raise HTTPException(404, "Resume entry not found") from exc
        raise HTTPException(400, "Resume analysis failed") from exc
    except Exception as exc:
        logger.exception("Vault analyze failed for uid=%s resume_id=%s version_id=%s", uid, resume_id, version_id)
        raise HTTPException(500, "Resume analysis failed. Please try again.") from exc

    return {
        "resume_id": resume_id,
        "version_id": version_id,
        "version_number": version.get("version_number"),
        "scorecard": scorecard.model_dump(),
        "entry_scorecard_updated": updates_entry_scorecard,
    }


@router.post("/compare")
async def compare(payload: Dict[str, Any], uid: str = Depends(verify_firebase_token)):
    await check_rate_limit(uid, "vault_compare", limit=10, window_seconds=60)

    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid request body")

    resume_a = _clean_required_string(payload.get("resume_a_id"), "resume_a_id")
    resume_b = _clean_required_string(payload.get("resume_b_id"), "resume_b_id")
    role = _clean_optional_string(payload.get("role"), "role")
    version_a_id = _clean_optional_string(payload.get("version_a_id"), "version_a_id")
    version_b_id = _clean_optional_string(payload.get("version_b_id"), "version_b_id")

    if resume_a == resume_b and version_a_id and version_b_id and version_a_id == version_b_id:
        raise HTTPException(400, "Select two different versions to compare")

    entry_a = await get_vault_entry(uid, resume_a)
    entry_b = await get_vault_entry(uid, resume_b)
    if not entry_a or not entry_b:
        raise HTTPException(404, "Resume entry not found")

    if not version_a_id:
        version_a_id = entry_a.get("current_version_id")
    if not version_b_id:
        version_b_id = entry_b.get("current_version_id")
    if not version_a_id or not version_b_id:
        raise HTTPException(404, "Both resumes must have a version")

    if version_a_id == version_b_id:
        raise HTTPException(400, "Select two different versions to compare")

    try:
        version_a = await _require_linked_version(
            uid,
            resume_a,
            version_a_id,
            mismatch_status_code=409,
            mismatch_message="version_a_id is no longer linked to resume_a_id",
        )
        version_b = await _require_linked_version(
            uid,
            resume_b,
            version_b_id,
            mismatch_status_code=409,
            mismatch_message="version_b_id is no longer linked to resume_b_id",
        )
    except HTTPException as exc:
        logger.warning(
            "Vault compare rejected for uid=%s resume_a=%s resume_b=%s status=%s detail=%s",
            uid,
            resume_a,
            resume_b,
            exc.status_code,
            exc.detail,
        )
        raise

    profile_a = version_a.get("profile_snapshot") or {}
    profile_b = version_b.get("profile_snapshot") or {}

    try:
        result = await compare_profiles(profile_a, profile_b, role=role)
    except ValueError as exc:
        logger.warning(
            "Vault compare rejected for uid=%s resume_a=%s resume_b=%s error=%s",
            uid,
            resume_a,
            resume_b,
            exc,
        )
        raise HTTPException(400, "Resume comparison failed") from exc
    except Exception as exc:
        logger.exception("Vault compare failed for uid=%s resume_a=%s resume_b=%s", uid, resume_a, resume_b)
        raise HTTPException(500, "Resume comparison failed. Please try again.") from exc

    result["resume_a_id"] = resume_a
    result["resume_b_id"] = resume_b
    result["resume_a_version_id"] = version_a_id
    result["resume_b_version_id"] = version_b_id
    result["resume_a_name"] = entry_a.get("name")
    result["resume_b_name"] = entry_b.get("name")
    result["version_a_number"] = version_a.get("version_number")
    result["version_b_number"] = version_b.get("version_number")
    result["version_a_filename"] = version_a.get("source_filename")
    result["version_b_filename"] = version_b.get("source_filename")
    result["version_a_has_source_file"] = bool(version_a.get("has_source_file"))
    result["version_b_has_source_file"] = bool(version_b.get("has_source_file"))
    return result
