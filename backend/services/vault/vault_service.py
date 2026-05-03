import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from firebase_admin import firestore

from firebase_config import db
from models.vault import ScorePoint, VaultScorecard
from services.vault.analysis_service import build_vault_scorecard, generate_diff_summary


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


def normalize_tags(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    raw = raw.strip()
    if not raw:
        return []
    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(t).strip() for t in parsed if str(t).strip()]
        except Exception:
            pass
    return [t.strip() for t in raw.split(",") if t.strip()]


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
        "name": name,
        "tags": tags,
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

    version_data = {
        "id": version_id,
        "resume_id": resume_id,
        "version_number": version_number,
        "created_at": now,
        "user_note": user_note or "",
        "score_at_version": scorecard.score,
        "diff_summary": diff_summary,
        "profile_snapshot": profile_snapshot,
    }

    _versions_collection(uid, resume_id).document(version_id).set(version_data)

    score_history = list(entry.get("score_history") or [])
    score_history.append(ScorePoint(version_number=version_number, score=scorecard.score, created_at=now).model_dump())

    entry_update = {
        "current_version_id": version_id,
        "version_count": version_number,
        "last_updated": now,
        "scorecard": scorecard.model_dump(),
        "score_history": score_history,
    }

    _vault_collection(uid).document(resume_id).set(entry_update, merge=True)

    return version_data, scorecard


async def list_versions(uid: str, resume_id: str) -> List[Dict[str, Any]]:
    versions: List[Dict[str, Any]] = []
    for doc in _versions_collection(uid, resume_id).order_by("version_number", direction=firestore.Query.DESCENDING).stream():
        payload = doc.to_dict() or {}
        payload.setdefault("id", doc.id)
        versions.append(payload)
    return versions


async def get_version_by_id(uid: str, version_id: str) -> Optional[Dict[str, Any]]:
    query = db.collection_group("versions").where("id", "==", version_id).limit(1).stream()
    for doc in query:
        path = doc.reference.path
        if not path.startswith(f"users/{uid}/"):
            continue
        payload = doc.to_dict() or {}
        payload.setdefault("id", doc.id)
        return payload
    return None


async def restore_version(uid: str, version_id: str, role: Optional[str] = None) -> Dict[str, Any]:
    version = await get_version_by_id(uid, version_id)
    if not version:
        raise ValueError("version_not_found")
    resume_id = version.get("resume_id")
    if not resume_id:
        raise ValueError("resume_not_found")

    profile_snapshot = version.get("profile_snapshot") or {}
    scorecard = await build_vault_scorecard(profile_snapshot, role=role)
    now = _now()

    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise ValueError("resume_not_found")

    score_history = list(entry.get("score_history") or [])
    score_history.append(ScorePoint(version_number=version.get("version_number", 0), score=scorecard.score, created_at=now).model_dump())

    _versions_collection(uid, resume_id).document(version_id).set(
        {"score_at_version": scorecard.score},
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

    return {"resume_id": resume_id, "version_id": version_id, "scorecard": scorecard.model_dump()}


async def set_active_resume(uid: str, resume_id: str) -> None:
    entries = await list_vault_entries(uid)
    batch = db.batch()
    for entry in entries:
        ref = _vault_collection(uid).document(entry["id"])
        batch.set(ref, {"is_active": entry["id"] == resume_id}, merge=True)
    batch.commit()

    meta = await get_vault_meta(uid)
    await set_vault_meta(uid, meta.get("resume_count", 0), resume_id)


async def update_entry(uid: str, resume_id: str, name: Optional[str], tags: Optional[List[str]]) -> Dict[str, Any]:
    updates: Dict[str, Any] = {"last_updated": _now()}
    if name is not None:
        updates["name"] = name
    if tags is not None:
        updates["tags"] = tags
    _vault_collection(uid).document(resume_id).set(updates, merge=True)
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise ValueError("resume_not_found")
    return entry


async def delete_resume_entry(uid: str, resume_id: str) -> None:
    versions = await list_versions(uid, resume_id)
    batch = db.batch()
    for version in versions:
        ref = _versions_collection(uid, resume_id).document(version["id"])
        batch.delete(ref)
    batch.delete(_vault_collection(uid).document(resume_id))
    batch.commit()

    meta = await get_vault_meta(uid)
    resume_count = max(0, int(meta.get("resume_count", 0)) - 1)
    active_id = meta.get("active_resume_id")
    if active_id == resume_id:
        active_id = None
    await set_vault_meta(uid, resume_count, active_id)


async def update_version_score(uid: str, resume_id: str, version_id: str, score: int) -> None:
    _versions_collection(uid, resume_id).document(version_id).set(
        {"score_at_version": score},
        merge=True,
    )


async def update_entry_scorecard(
    uid: str,
    resume_id: str,
    scorecard: VaultScorecard,
    version_number: Optional[int] = None,
) -> None:
    entry = await get_vault_entry(uid, resume_id)
    if not entry:
        raise ValueError("resume_not_found")
    score_history = list(entry.get("score_history") or [])
    if version_number is not None:
        score_history.append(
            ScorePoint(version_number=version_number, score=scorecard.score, created_at=_now()).model_dump()
        )
    _vault_collection(uid).document(resume_id).set(
        {
            "scorecard": scorecard.model_dump(),
            "last_updated": scorecard.last_analyzed_at,
            "score_history": score_history,
        },
        merge=True,
    )
