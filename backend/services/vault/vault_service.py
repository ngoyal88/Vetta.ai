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
from services.resume.profile_normalizer import profile_snapshot_dict
from services.vault.analysis_service import build_vault_scorecard, generate_diff_summary
from services.vault import file_storage


MAX_RESUMES_PER_USER = 5
MAX_VERSIONS_PER_RESUME = 5
MAX_SCORE_HISTORY = 50


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


def _cap_score_history(score_history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if len(score_history) <= MAX_SCORE_HISTORY:
        return score_history
    return score_history[-MAX_SCORE_HISTORY:]


def _normalize_version_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    snapshot = payload.get("profile_snapshot")
    if isinstance(snapshot, dict) and snapshot:
        payload = dict(payload)
        payload["profile_snapshot"] = profile_snapshot_dict(snapshot)
    payload.setdefault("builder", None)
    return payload


def _normalize_entry_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(payload)
    payload.setdefault("origin", "upload")
    return payload


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
        entries.append(_normalize_entry_payload(payload))
    return entries


async def get_vault_entry(uid: str, resume_id: str) -> Optional[Dict[str, Any]]:
    snap = _vault_collection(uid).document(resume_id).get()
    if not snap.exists:
        return None
    payload = snap.to_dict() or {}
    payload.setdefault("id", resume_id)
    return _normalize_entry_payload(payload)


@firestore.transactional
def _create_resume_entry_txn(
    transaction: firestore.Transaction,
    uid: str,
    name: str,
    tags: List[str],
    is_active: bool,
    origin: str = "upload",
) -> Dict[str, Any]:
    meta_ref = _vault_meta_ref(uid)
    meta_snap = meta_ref.get(transaction=transaction)
    meta = meta_snap.to_dict() if meta_snap.exists else {}
    resume_count = int(meta.get("resume_count", 0))
    if resume_count >= MAX_RESUMES_PER_USER:
        raise ValueError("resume_limit_reached")

    resume_id = str(uuid.uuid4())
    now = _now()
    active_resume_id = meta.get("active_resume_id")
    if is_active or not active_resume_id:
        active_resume_id = resume_id

    data = {
        "id": resume_id,
        "user_id": uid,
        "name": normalize_entry_name(name),
        "tags": normalize_tags(tags),
        "origin": origin if origin == "builder" else "upload",
        "is_active": is_active or not meta.get("active_resume_id"),
        "created_at": now,
        "last_updated": now,
        "current_version_id": None,
        "version_count": 0,
        "scorecard": None,
        "score_history": [],
        "interview_session_ids": [],
        "avg_interview_score": None,
    }
    transaction.set(_vault_collection(uid).document(resume_id), data)
    transaction.set(
        meta_ref,
        {
            "resume_count": resume_count + 1,
            "active_resume_id": active_resume_id,
        },
        merge=True,
    )
    return data


async def create_resume_entry(
    uid: str,
    name: str,
    tags: List[str],
    is_active: bool,
    *,
    origin: str = "upload",
) -> Dict[str, Any]:
    def _run() -> Dict[str, Any]:
        transaction = db.transaction()
        return _create_resume_entry_txn(transaction, uid, name, tags, is_active, origin)

    return await asyncio.to_thread(_run)


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
    action: str = "upload",
    builder_metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], VaultScorecard]:
    canonical_snapshot = profile_snapshot_dict(profile_snapshot)
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise ValueError("resume_not_found")

    version_count = int(entry.get("version_count", 0))
    if version_count >= MAX_VERSIONS_PER_RESUME:
        raise ValueError("version_limit_reached")

    now = _now()
    version_id = str(uuid.uuid4())

    diff_summary = None
    if version_count > 0:
        last_version_id = entry.get("current_version_id")
        if last_version_id:
            last_snap = _versions_collection(uid, resume_id).document(last_version_id).get()
            if last_snap.exists:
                prev = (last_snap.to_dict() or {}).get("profile_snapshot") or {}
                diff_summary = await generate_diff_summary(prev, canonical_snapshot)

    scorecard = await build_vault_scorecard(canonical_snapshot, role=role)

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
        "version_number": version_count + 1,
        "created_at": now,
        "user_note": user_note or "",
        "score_at_version": scorecard.score,
        "latest_score": scorecard.score,
        "diff_summary": diff_summary,
        "profile_snapshot": canonical_snapshot,
        **file_meta,
    }
    if builder_metadata:
        version_data["builder"] = builder_metadata

    score_point = _build_score_point(
        version_count + 1,
        scorecard.score,
        version_id=version_id,
        action=action,
        role=role,
        created_at=now,
    )

    try:
        await asyncio.to_thread(
            _persist_version_txn,
            uid,
            resume_id,
            version_id,
            version_data,
            score_point,
            scorecard,
            now,
        )
        await _invalidate_jd_fit_cache(uid)
    except ValueError as exc:
        if str(exc) == "version_limit_reached" and file_meta.get("has_source_file"):
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

    version_data["version_number"] = version_count + 1
    return version_data, scorecard


@firestore.transactional
def _persist_version_txn(
    transaction: firestore.Transaction,
    uid: str,
    resume_id: str,
    version_id: str,
    version_data: Dict[str, Any],
    score_point: Dict[str, Any],
    scorecard: VaultScorecard,
    now: datetime,
) -> None:
    entry_ref = _vault_collection(uid).document(resume_id)
    entry_snap = entry_ref.get(transaction=transaction)
    if not entry_snap.exists:
        raise ValueError("resume_not_found")
    entry = entry_snap.to_dict() or {}
    version_count = int(entry.get("version_count", 0))
    if version_count >= MAX_VERSIONS_PER_RESUME:
        raise ValueError("version_limit_reached")

    version_number = version_count + 1
    version_payload = dict(version_data)
    version_payload["version_number"] = version_number

    score_history = _cap_score_history(list(entry.get("score_history") or []) + [score_point])
    transaction.set(_versions_collection(uid, resume_id).document(version_id), version_payload)
    transaction.set(
        entry_ref,
        {
            "current_version_id": version_id,
            "version_count": version_number,
            "last_updated": now,
            "scorecard": scorecard.model_dump(),
            "score_history": score_history,
        },
        merge=True,
    )


async def _invalidate_jd_fit_cache(uid: str) -> None:
    try:
        from services.jd_fit.jd_fit_repository import invalidate_user_jd_fit_cache

        await invalidate_user_jd_fit_cache(uid)
    except Exception:
        pass


async def list_versions(uid: str, resume_id: str) -> List[Dict[str, Any]]:
    versions: List[Dict[str, Any]] = []
    for doc in _versions_collection(uid, resume_id).order_by("version_number", direction=firestore.Query.DESCENDING).stream():
        payload = doc.to_dict() or {}
        payload.setdefault("id", doc.id)
        versions.append(_normalize_version_payload(payload))
    return versions


async def get_version_for_resume(uid: str, resume_id: str, version_id: str) -> Optional[Dict[str, Any]]:
    snap = _versions_collection(uid, resume_id).document(version_id).get()
    if not snap.exists:
        return None
    payload = snap.to_dict() or {}
    payload.setdefault("id", version_id)
    payload.setdefault("resume_id", resume_id)
    return _normalize_version_payload(payload)


async def get_version_by_id(uid: str, version_id: str) -> Optional[Dict[str, Any]]:
    def _read():
        query = db.collection_group("versions").where("id", "==", version_id).limit(1).stream()
        for doc in query:
            path = doc.reference.path
            if not path.startswith(f"users/{uid}/"):
                continue
            payload = doc.to_dict() or {}
            payload.setdefault("id", doc.id)
            return _normalize_version_payload(payload)
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
    score_history = _cap_score_history(score_history)

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
    def _run() -> None:
        transaction = db.transaction()
        _set_active_resume_txn(transaction, uid, resume_id)

    await asyncio.to_thread(_run)


@firestore.transactional
def _set_active_resume_txn(transaction: firestore.Transaction, uid: str, resume_id: str) -> None:
    entry_ref = _vault_collection(uid).document(resume_id)
    if not entry_ref.get(transaction=transaction).exists:
        raise ValueError("resume_not_found")

    for doc in _vault_collection(uid).stream(transaction=transaction):
        ref = doc.reference
        transaction.set(ref, {"is_active": ref.id == resume_id}, merge=True)

    meta_ref = _vault_meta_ref(uid)
    meta_snap = meta_ref.get(transaction=transaction)
    meta = meta_snap.to_dict() if meta_snap.exists else {}
    transaction.set(
        meta_ref,
        {
            "resume_count": int(meta.get("resume_count", 0)),
            "active_resume_id": resume_id,
        },
        merge=True,
    )


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
    score_history = _cap_score_history(score_history)
    _vault_collection(uid).document(resume_id).set(
        {
            "scorecard": scorecard.model_dump(),
            "last_updated": scorecard.last_analyzed_at,
            "score_history": score_history,
        },
        merge=True,
    )
