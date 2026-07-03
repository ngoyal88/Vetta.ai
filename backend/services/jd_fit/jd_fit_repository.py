"""Firestore persistence and Redis cache for JD Fit snapshots."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from firebase_admin import firestore

from firebase_config import db
from services.jd_fit.hash_utils import inputs_hash
from services.jd_fit.jd_fit_models import HistoryEntry
from services.jd_fit.jd_fit_weights import BOTTLENECK_LABELS, SCHEMA_VERSION
from utils.logger import get_logger
from utils.redis_client import get_redis

logger = get_logger(__name__)

CACHE_TTL_SECONDS = 300
COLLECTION_NAME = "jd_fit_snapshots"


def _collection(uid: str):
    return db.collection("users").document(uid).collection(COLLECTION_NAME)


def _cache_key(uid: str, digest: str) -> str:
    return f"jd_fit:cache:{uid}:{digest}"


def _serialize_ts(value: Any) -> str:
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    if hasattr(value, "to_datetime"):
        try:
            dt = value.to_datetime()
            if isinstance(dt, datetime):
                dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
                return dt.isoformat()
        except Exception:
            pass
    return str(value or "")


async def get_cached_snapshot_id(uid: str, digest: str) -> Optional[str]:
    try:
        client = await get_redis()
        snapshot_id = await client.get(_cache_key(uid, digest))
        return snapshot_id if snapshot_id else None
    except Exception as exc:
        logger.warning("JD fit cache read failed: %s", exc)
        return None


async def set_cached_snapshot_id(uid: str, digest: str, snapshot_id: str) -> None:
    try:
        client = await get_redis()
        await client.setex(_cache_key(uid, digest), CACHE_TTL_SECONDS, snapshot_id)
    except Exception as exc:
        logger.warning("JD fit cache write failed: %s", exc)


def _create_snapshot_sync(uid: str, payload: Dict[str, Any]) -> str:
    snapshot_id = f"snap_{uuid.uuid4().hex[:12]}"
    doc = dict(payload)
    doc["snapshot_id"] = snapshot_id
    doc["schema_version"] = SCHEMA_VERSION
    doc["created_at"] = firestore.SERVER_TIMESTAMP
    _collection(uid).document(snapshot_id).set(doc)
    return snapshot_id


async def create_snapshot(uid: str, payload: Dict[str, Any]) -> str:
    return await asyncio.to_thread(_create_snapshot_sync, uid, payload)


def _get_snapshot_sync(uid: str, snapshot_id: str) -> Optional[Dict[str, Any]]:
    snap = _collection(uid).document(snapshot_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    data["snapshot_id"] = snap.id
    return data


async def get_snapshot(uid: str, snapshot_id: str) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_get_snapshot_sync, uid, snapshot_id)


async def get_snapshot_for_user(uid: str, snapshot_id: str) -> Optional[Dict[str, Any]]:
    """Interview handoff — ownership enforced."""
    return await get_snapshot(uid, snapshot_id)


def _list_history_sync(
    uid: str,
    target_role: str,
    jd_digest: Optional[str],
    limit: int,
) -> List[Dict[str, Any]]:
    q = _collection(uid).where(filter=firestore.FieldFilter("target_role", "==", target_role.strip()))
    if jd_digest:
        q = q.where(filter=firestore.FieldFilter("jd_hash", "==", jd_digest))
    q = q.order_by("created_at", direction=firestore.Query.DESCENDING).limit(max(1, min(limit, 50)))
    rows: List[Dict[str, Any]] = []
    for doc in q.stream():
        data = doc.to_dict() or {}
        data["snapshot_id"] = doc.id
        rows.append(data)
    return rows


async def list_history(
    uid: str,
    target_role: str,
    jd_digest: Optional[str] = None,
    limit: int = 20,
) -> List[HistoryEntry]:
    raw_rows = await asyncio.to_thread(_list_history_sync, uid, target_role, jd_digest, limit)
    history: List[HistoryEntry] = []
    prev_score: Optional[int] = None
    for row in reversed(raw_rows):
        score = int(row.get("application_fit_score") or 0)
        stage = row.get("bottleneck_stage") or "none"
        computed_at = _serialize_ts(row.get("computed_at") or row.get("created_at"))
        delta: Optional[int] = None
        if prev_score is not None:
            delta = score - prev_score
        prev_score = score
        history.append(
            HistoryEntry(
                snapshot_id=str(row.get("snapshot_id") or ""),
                application_fit_score=score,
                prepared_fit_score=row.get("prepared_fit_score"),
                bottleneck_stage=stage,
                bottleneck_label=BOTTLENECK_LABELS.get(stage, str(stage)),
                computed_at=computed_at,
                delta_vs_previous=delta,
            )
        )
    history.reverse()
    return history


async def invalidate_user_jd_fit_cache(uid: str) -> None:
    """Best-effort purge of Redis JD Fit digest cache for a user."""
    try:
        client = await get_redis()
        pattern = f"jd_fit:cache:{uid}:*"
        cursor = 0
        while True:
            cursor, keys = await client.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                await client.delete(*keys)
            if cursor == 0:
                break
    except Exception as exc:
        logger.warning("JD fit cache invalidate failed uid=%s: %s", uid, exc)


def build_inputs_digest(
    uid: str,
    target_role: str,
    job_description: str,
    resume_id: Optional[str],
    version_id: Optional[str],
    target_company: Optional[str] = None,
    profile_revision: Optional[str] = None,
    profile_content_hash: Optional[str] = None,
) -> str:
    return inputs_hash(
        uid,
        target_role,
        job_description,
        resume_id,
        version_id,
        SCHEMA_VERSION,
        target_company=target_company,
        profile_revision=profile_revision,
        profile_content_hash=profile_content_hash,
    )
