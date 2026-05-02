from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

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
from services.vault.vault_service import normalize_tags, set_vault_meta
from utils.auth import verify_firebase_token
from utils.logger import get_logger

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
    if not _allowed_file(file.filename, file.content_type):
        raise HTTPException(400, "Unsupported file type. Allowed: PDF, DOCX, TXT.")
    blob = await file.read(MAX_RESUME_SIZE_BYTES + 1)
    if len(blob) > MAX_RESUME_SIZE_BYTES:
        raise HTTPException(413, "File too large. Max size 5 MB.")
    if not blob:
        raise HTTPException(400, "empty file")

    meta = await get_vault_meta(uid)
    resume_count = int(meta.get("resume_count", 0))
    active_resume_id = meta.get("active_resume_id")

    tags_list = normalize_tags(tags)

    if not resume_id:
        if resume_count >= MAX_RESUMES_PER_USER:
            raise HTTPException(403, f"Resume limit reached (max {MAX_RESUMES_PER_USER}).")
        if not name or not name.strip():
            raise HTTPException(400, "name is required")
        is_active = active_resume_id is None
        entry = await create_resume_entry(uid, name.strip(), tags_list, is_active)
        resume_id = entry["id"]
        resume_count += 1
        if is_active:
            active_resume_id = resume_id
        await set_vault_meta(uid, resume_count, active_resume_id)
    else:
        entry = await get_vault_entry(uid, resume_id)
        if not entry:
            raise HTTPException(404, "Resume entry not found")

    try:
        parsed = await parse_resume_llm(blob, file.filename, uid, persist=False)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        logger.exception("Vault resume parse failed")
        raise HTTPException(500, "Resume parsing failed. Please try again.") from exc

    try:
        version, scorecard = await add_version(
            uid,
            resume_id,
            parsed.profile.dict(),
            user_note or "",
            role=role,
        )
    except ValueError as exc:
        if str(exc) == "version_limit_reached":
            raise HTTPException(403, f"Version limit reached (max {MAX_VERSIONS_PER_RESUME}).") from exc
        raise HTTPException(400, "Failed to create version") from exc

    entry = await get_vault_entry(uid, resume_id)
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
    name = payload.get("name")
    tags = payload.get("tags")
    if tags is not None and not isinstance(tags, list):
        raise HTTPException(400, "tags must be an array")
    updated = await update_entry(uid, resume_id, name, tags)
    return updated


@router.delete("/vault/{resume_id}")
async def delete_vault_item(resume_id: str, uid: str = Depends(verify_firebase_token)):
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise HTTPException(404, "Resume entry not found")
    await delete_resume_entry(uid, resume_id)
    return {"status": "deleted"}


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


@router.post("/restore/{version_id}")
async def restore(version_id: str, payload: Dict[str, Any], uid: str = Depends(verify_firebase_token)):
    role = payload.get("role") if isinstance(payload, dict) else None
    try:
        result = await restore_version(uid, version_id, role=role)
    except ValueError as exc:
        if str(exc) == "version_not_found":
            raise HTTPException(404, "Version not found") from exc
        raise HTTPException(400, "Restore failed") from exc
    return result


@router.post("/analyze")
async def analyze(payload: Dict[str, Any], uid: str = Depends(verify_firebase_token)):
    resume_id = payload.get("resume_id")
    version_id = payload.get("version_id")
    role = payload.get("role")
    if not resume_id:
        raise HTTPException(400, "resume_id is required")
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise HTTPException(404, "Resume entry not found")

    if not version_id:
        version_id = entry.get("current_version_id")
    if not version_id:
        raise HTTPException(404, "No version available to analyze")

    version = await get_version_by_id(uid, version_id)
    if not version:
        raise HTTPException(404, "Version not found")

    profile_snapshot = version.get("profile_snapshot") or {}
    scorecard = await build_vault_scorecard(profile_snapshot, role=role)
    await update_version_score(uid, resume_id, version_id, scorecard.score)
    await update_entry_scorecard(uid, resume_id, scorecard, version_number=version.get("version_number"))

    return {"scorecard": scorecard.model_dump()}


@router.post("/compare")
async def compare(payload: Dict[str, Any], uid: str = Depends(verify_firebase_token)):
    resume_a = payload.get("resume_a_id")
    resume_b = payload.get("resume_b_id")
    role = payload.get("role")
    if not resume_a or not resume_b:
        raise HTTPException(400, "resume_a_id and resume_b_id are required")

    entry_a = await get_vault_entry(uid, resume_a)
    entry_b = await get_vault_entry(uid, resume_b)
    if not entry_a or not entry_b:
        raise HTTPException(404, "Resume entry not found")

    version_a_id = entry_a.get("current_version_id")
    version_b_id = entry_b.get("current_version_id")
    if not version_a_id or not version_b_id:
        raise HTTPException(404, "Both resumes must have a version")

    version_a = await get_version_by_id(uid, version_a_id)
    version_b = await get_version_by_id(uid, version_b_id)
    if not version_a or not version_b:
        raise HTTPException(404, "Version not found")

    profile_a = version_a.get("profile_snapshot") or {}
    profile_b = version_b.get("profile_snapshot") or {}

    result = await compare_profiles(profile_a, profile_b, role=role)
    result["resume_a_id"] = resume_a
    result["resume_b_id"] = resume_b
    return result
