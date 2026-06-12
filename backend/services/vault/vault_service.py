import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from firebase_admin import firestore

from firebase_config import db
from models.vault import (
    ScorePoint,
    VaultScorecard,
    normalize_vault_name,
    normalize_vault_tag_list,
    normalize_vault_tags,
)
from services.vault.analysis_service import build_vault_scorecard, generate_diff_summary
from services.vault import file_storage


MAX_RESUMES_PER_USER = 5
MAX_VERSIONS_PER_RESUME = 5


def _vault_meta_ref(uid: str):
    return db.collection("users").document(uid).collection("vault_meta").document("meta")


def _vault_collection(uid: str):
    return db.collection("users").document(uid).collection("vault")


def _versions_collection(uid: str, resume_id: str):
    return _vault_collection(uid).document(resume_id).collection("versions")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _build_score_point(
    version_number: int,
    score: int,
    *,
    version_id: Optional[str] = None,
    action: Optional[str] = None,
    role: Optional[str] = None,
    created_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    return ScorePoint(
        version_number=version_number,
        score=score,
        created_at=created_at or _now(),
        version_id=version_id,
        action=action,
        role=role,
    ).model_dump()


def normalize_tags(raw: Any) -> List[str]:
    return normalize_vault_tags(raw)


def normalize_update_tags(raw: Any) -> List[str]:
    return normalize_vault_tag_list(raw)


def normalize_entry_name(raw: Any) -> str:
    if not isinstance(raw, str):
        raise ValueError("invalid_name")
    try:
        return normalize_vault_name(raw)
    except ValueError as exc:
        if str(exc) == "name_blank":
            raise ValueError("invalid_name") from exc
        raise


async def get_vault_meta(uid: str) -> Dict[str, Any]:
    ref = _vault_meta_ref(uid)
    snap = ref.get()
    if snap.exists:
        data = snap.to_dict() or {}
        return {
            "resume_count": int(data.get("resume_count", 0)),
            "active_resume_id": data.get("active_resume_id"),
        }
    return {"resume_count": 0, "active_resume_id": None}


async def set_vault_meta(uid: str, resume_count: int, active_resume_id: Optional[str]) -> None:
    _vault_meta_ref(uid).set(
        {
            "resume_count": resume_count,
            "active_resume_id": active_resume_id,
        },
        merge=True,
    )


async def list_vault_entries(uid: str) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    for doc in _vault_collection(uid).order_by("last_updated", direction=firestore.Query.DESCENDING).stream():
        payload = doc.to_dict() or {}
        payload.setdefault("id", doc.id)
        entries.append(payload)
    return entries


async def get_vault_entry(uid: str, resume_id: str) -> Optional[Dict[str, Any]]:
    snap = _vault_collection(uid).document(resume_id).get()
    if not snap.exists:
        return None
    payload = snap.to_dict() or {}
    payload.setdefault("id", resume_id)
    return payload


async def create_resume_entry(
    uid: str,
    name: str,
    tags: List[str],
    is_active: bool,
) -> Dict[str, Any]:
    resume_id = str(uuid.uuid4())
    now = _now()
    data = {
        "id": resume_id,
        "user_id": uid,
        "name": normalize_entry_name(name),
        "tags": normalize_tags(tags),
        "is_active": is_active,
        "created_at": now,
        "last_updated": now,
        "current_version_id": None,
        "version_count": 0,
        "scorecard": None,
        "score_history": [],
        "interview_session_ids": [],
        "avg_interview_score": None,
    }
    _vault_collection(uid).document(resume_id).set(data)
    return data


async def add_version(
    uid: str,
    resume_id: str,
    profile_snapshot: Dict[str, Any],
    user_note: str,
    role: Optional[str] = None,
    *,
    source_filename: Optional[str] = None,
    source_blob: Optional[bytes] = None,
    content_type: Optional[str] = None,
) -> Tuple[Dict[str, Any], VaultScorecard]:
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise ValueError("resume_not_found")

    version_count = int(entry.get("version_count", 0))
    if version_count >= MAX_VERSIONS_PER_RESUME:
        raise ValueError("version_limit_reached")

    now = _now()
    version_number = version_count + 1
    version_id = str(uuid.uuid4())

    diff_summary = None
    if version_count > 0:
        last_version_id = entry.get("current_version_id")
        if last_version_id:
            last_snap = _versions_collection(uid, resume_id).document(last_version_id).get()
            if last_snap.exists:
                prev = (last_snap.to_dict() or {}).get("profile_snapshot") or {}
                diff_summary = await generate_diff_summary(prev, profile_snapshot)

    scorecard = await build_vault_scorecard(profile_snapshot, role=role)

    file_meta: Dict[str, Any] = {
        "source_filename": None,
        "content_type": None,
        "has_source_file": False,
        "storage_path": None,
        "storage_backend": None,
    }
    if source_blob and source_filename:
        storage_path, resolved_content_type, storage_backend = await asyncio.to_thread(
            file_storage.save_version_file,
            uid,
            resume_id,
            version_id,
            source_filename,
            source_blob,
        )
        file_meta = {
            "source_filename": source_filename,
            "content_type": content_type or resolved_content_type,
            "has_source_file": True,
            "storage_path": storage_path,
            "storage_backend": storage_backend,
        }

    version_data = {
        "id": version_id,
        "resume_id": resume_id,
        "version_number": version_number,
        "created_at": now,
        "user_note": user_note or "",
        "score_at_version": scorecard.score,
        "latest_score": scorecard.score,
        "diff_summary": diff_summary,
        "profile_snapshot": profile_snapshot,
        **file_meta,
    }

    try:
        _versions_collection(uid, resume_id).document(version_id).set(version_data)

        score_history = list(entry.get("score_history") or [])
        score_history.append(
            _build_score_point(
                version_number,
                scorecard.score,
                version_id=version_id,
                action="upload",
                role=role,
                created_at=now,
            )
        )

        entry_update = {
            "current_version_id": version_id,
            "version_count": version_number,
            "last_updated": now,
            "scorecard": scorecard.model_dump(),
            "score_history": score_history,
        }

        _vault_collection(uid).document(resume_id).set(entry_update, merge=True)
    except Exception:
        if file_meta.get("has_source_file"):
            await asyncio.to_thread(
                file_storage.delete_version_file,
                uid,
                resume_id,
                version_id,
                source_filename,
                storage_path=file_meta.get("storage_path"),
                storage_backend=file_meta.get("storage_backend"),
            )
        raise

    return version_data, scorecard


async def list_versions(uid: str, resume_id: str) -> List[Dict[str, Any]]:
    versions: List[Dict[str, Any]] = []
    for doc in _versions_collection(uid, resume_id).order_by("version_number", direction=firestore.Query.DESCENDING).stream():
        payload = doc.to_dict() or {}
        payload.setdefault("id", doc.id)
        versions.append(payload)
    return versions


async def get_version_for_resume(uid: str, resume_id: str, version_id: str) -> Optional[Dict[str, Any]]:
    snap = _versions_collection(uid, resume_id).document(version_id).get()
    if not snap.exists:
        return None
    payload = snap.to_dict() or {}
    payload.setdefault("id", version_id)
    payload.setdefault("resume_id", resume_id)
    return payload


async def get_version_by_id(uid: str, version_id: str) -> Optional[Dict[str, Any]]:
    def _read():
        query = db.collection_group("versions").where("id", "==", version_id).limit(1).stream()
        for doc in query:
            path = doc.reference.path
            if not path.startswith(f"users/{uid}/"):
                continue
            payload = doc.to_dict() or {}
            payload.setdefault("id", doc.id)
            return payload
        return None

    return await asyncio.to_thread(_read)


async def restore_version(uid: str, version_id: str, role: Optional[str] = None) -> Dict[str, Any]:
    version = await get_version_by_id(uid, version_id)
    if not version:
        raise ValueError("version_not_found")
    resume_id = version.get("resume_id")
    if not resume_id:
        raise ValueError("version_resume_mismatch")

    linked_version = await get_version_for_resume(uid, resume_id, version_id)
    if not linked_version:
        raise ValueError("version_resume_mismatch")

    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise ValueError("resume_not_found")

    profile_snapshot = linked_version.get("profile_snapshot") or {}
    scorecard = await build_vault_scorecard(profile_snapshot, role=role)
    now = _now()

    score_history = list(entry.get("score_history") or [])
    score_history.append(
        _build_score_point(
            linked_version.get("version_number", 0),
            scorecard.score,
            version_id=version_id,
            action="restore",
            role=role,
            created_at=now,
        )
    )

    _versions_collection(uid, resume_id).document(version_id).set(
        {"latest_score": scorecard.score},
        merge=True,
    )

    _vault_collection(uid).document(resume_id).set(
        {
            "current_version_id": version_id,
            "last_updated": now,
            "scorecard": scorecard.model_dump(),
            "score_history": score_history,
        },
        merge=True,
    )

    return {
        "resume_id": resume_id,
        "version_id": version_id,
        "version_number": linked_version.get("version_number"),
        "restored_current_version": True,
        "scorecard": scorecard.model_dump(),
    }


async def set_active_resume(uid: str, resume_id: str) -> None:
    entries = await list_vault_entries(uid)
    if not any(entry["id"] == resume_id for entry in entries):
        raise ValueError("resume_not_found")

    batch = db.batch()
    for entry in entries:
        ref = _vault_collection(uid).document(entry["id"])
        batch.set(ref, {"is_active": entry["id"] == resume_id}, merge=True)
    batch.commit()

    meta = await get_vault_meta(uid)
    await set_vault_meta(uid, meta.get("resume_count", 0), resume_id)


async def update_entry(uid: str, resume_id: str, name: Optional[str], tags: Optional[List[str]]) -> Dict[str, Any]:
    existing = await get_vault_entry(uid, resume_id)
    if not existing:
        raise ValueError("resume_not_found")

    updates: Dict[str, Any] = {"last_updated": _now()}
    if name is not None:
        updates["name"] = normalize_entry_name(name)
    if tags is not None:
        updates["tags"] = normalize_update_tags(tags)
    _vault_collection(uid).document(resume_id).update(updates)
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise ValueError("resume_not_found")
    return entry


def _select_fallback_active_resume(entries: List[Dict[str, Any]]) -> Optional[str]:
    if not entries:
        return None

    for entry in entries:
        if entry.get("current_version_id"):
            return entry["id"]

    return entries[0]["id"]


async def delete_resume_entry(uid: str, resume_id: str) -> None:
    deleted_entry = await get_vault_entry(uid, resume_id)
    if not deleted_entry:
        raise ValueError("resume_not_found")

    meta = await get_vault_meta(uid)
    previous_active_id = meta.get("active_resume_id")
    deleted_was_active = previous_active_id == resume_id or bool((deleted_entry or {}).get("is_active"))

    versions = await list_versions(uid, resume_id)
    for version in versions:
        if version.get("has_source_file"):
            await asyncio.to_thread(
                file_storage.delete_version_file,
                uid,
                resume_id,
                version["id"],
                version.get("source_filename"),
                storage_path=version.get("storage_path"),
                storage_backend=version.get("storage_backend"),
            )

    batch = db.batch()
    for version in versions:
        ref = _versions_collection(uid, resume_id).document(version["id"])
        batch.delete(ref)
    batch.delete(_vault_collection(uid).document(resume_id))
    batch.commit()

    await asyncio.to_thread(file_storage.delete_resume_files, uid, resume_id)

    remaining_entries = await list_vault_entries(uid)
    remaining_ids = {entry["id"] for entry in remaining_entries}

    next_active_id = previous_active_id if previous_active_id in remaining_ids else None
    if deleted_was_active or next_active_id is None:
        next_active_id = _select_fallback_active_resume(remaining_entries)

    if remaining_entries:
        active_batch = db.batch()
        dirty = False
        for entry in remaining_entries:
            should_be_active = entry["id"] == next_active_id
            if entry.get("is_active") == should_be_active:
                continue
            active_batch.set(
                _vault_collection(uid).document(entry["id"]),
                {"is_active": should_be_active},
                merge=True,
            )
            dirty = True
        if dirty:
            active_batch.commit()

    await set_vault_meta(uid, len(remaining_entries), next_active_id)


def _find_version_ref(uid: str, version_id: str):
    query = db.collection_group("versions").where("id", "==", version_id).limit(1).stream()
    for doc in query:
        path = doc.reference.path
        if not path.startswith(f"users/{uid}/"):
            continue
        return doc.reference
    return None


async def update_version_score(uid: str, version_id: str, score: int) -> None:
    ref = _find_version_ref(uid, version_id)
    if ref is None:
        raise ValueError("version_not_found")
    ref.set({"latest_score": score}, merge=True)


async def update_entry_scorecard(
    uid: str,
    resume_id: str,
    scorecard: VaultScorecard,
    version_number: Optional[int] = None,
    version_id: Optional[str] = None,
    action: Optional[str] = None,
    role: Optional[str] = None,
) -> None:
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise ValueError("resume_not_found")
    score_history = list(entry.get("score_history") or [])
    if version_number is not None:
        score_history.append(
            _build_score_point(
                version_number,
                scorecard.score,
                version_id=version_id,
                action=action,
                role=role,
                created_at=scorecard.last_analyzed_at,
            )
        )
    _vault_collection(uid).document(resume_id).set(
        {
            "scorecard": scorecard.model_dump(),
            "last_updated": scorecard.last_analyzed_at,
            "score_history": score_history,
        },
        merge=True,
    )
