from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Literal, Optional, Set, Tuple, TypeVar

SessionAccess = Literal["owned", "forbidden", "not_found"]

from firebase_admin import firestore

from config import get_settings
from firebase_config import db
from services.profile_memory.models import (
    EXTRACTION_VERSION,
    GAP_CATEGORY,
    SCHEMA_VERSION,
    VerifiedClaimDraft,
    summary_bucket_key,
)
from services.profile_memory.pipeline_state import get_pipeline_status, mark_pipeline_terminal
from services.profile_memory.umbrella_terms import normalize_text
from utils.logger import get_logger

logger = get_logger("ProfileClaimsRepository")

T = TypeVar("T")
_DEDUP_KEY_LIMIT = 500


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _run_sync(fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    return await asyncio.to_thread(fn, *args, **kwargs)


def _claims_collection(uid: str):
    return db.collection("users").document(uid).collection("profile_claims")


def _summary_ref(uid: str):
    return db.collection("users").document(uid).collection("candidate_profile_memory").document("summary")


def _counters_ref(uid: str):
    return db.collection("users").document(uid).collection("profile_meta").document("counters")


def claim_id_for(category: str, normalized_key: str) -> str:
    digest = hashlib.sha1(f"{category}:{normalized_key}".encode("utf-8")).hexdigest()[:16]
    return f"{category}_{digest}"


def get_max_accepted() -> int:
    return int(getattr(get_settings(), "vpm_max_accepted_claims", 50))


# --- Pipeline (delegates to pipeline_state for terminal) ---


async def get_pipeline_run(uid: str, session_id: str) -> Optional[Dict[str, Any]]:
    from services.profile_memory.pipeline_state import _pipeline_run_ref

    def _read():
        snap = _pipeline_run_ref(uid, session_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        data["id"] = snap.id
        return data

    return await _run_sync(_read)


async def mark_pipeline_completed(uid: str, session_id: str, stats: Dict[str, Any]) -> None:
    await _run_sync(mark_pipeline_terminal, uid, session_id, status="completed", stats=stats)


async def mark_pipeline_skipped(uid: str, session_id: str, stats: Dict[str, Any]) -> None:
    await _run_sync(mark_pipeline_terminal, uid, session_id, status="skipped", stats=stats)


async def mark_pipeline_failed(
    uid: str,
    session_id: str,
    *,
    error_code: str,
    error_message: str,
    stats: Optional[Dict[str, Any]] = None,
) -> None:
    await _run_sync(
        mark_pipeline_terminal,
        uid,
        session_id,
        status="failed",
        stats=stats,
        error_code=error_code,
        error_message=error_message,
    )


async def get_pipeline_status_async(uid: str, session_id: str) -> Dict[str, Any]:
    return await _run_sync(get_pipeline_status, uid, session_id)


# --- Counters ---


def _count_by_status(uid: str, status: str) -> int:
    count = 0
    for _ in _claims_collection(uid).where(filter=firestore.FieldFilter("status", "==", status)).stream():
        count += 1
    return count


def _ensure_counters(uid: str) -> Dict[str, int]:
    ref = _counters_ref(uid)
    snap = ref.get()
    if snap.exists:
        row = snap.to_dict() or {}
        return {
            "accepted_count": int(row.get("accepted_count") or 0),
            "pending_count": int(row.get("pending_count") or 0),
            "rejected_count": int(row.get("rejected_count") or 0),
        }
    counts = {
        "accepted_count": _count_by_status(uid, "accepted"),
        "pending_count": _count_by_status(uid, "pending"),
        "rejected_count": _count_by_status(uid, "rejected"),
    }
    ref.set({**counts, "updated_at": _now_iso()}, merge=True)
    return counts


async def get_counters(uid: str) -> Dict[str, int]:
    return await _run_sync(_ensure_counters, uid)


def _status_counter_field(status: str) -> Optional[str]:
    if status == "accepted":
        return "accepted_count"
    if status == "pending":
        return "pending_count"
    if status == "rejected":
        return "rejected_count"
    return None


# --- Dedup keys (indexed) ---


def _load_keys_for_status(uid: str, status: str) -> Set[str]:
    keys: Set[str] = set()
    last_doc = None
    while True:
        q = _claims_collection(uid).where(filter=firestore.FieldFilter("status", "==", status))
        if last_doc is not None:
            q = q.start_after(last_doc)
        q = q.limit(_DEDUP_KEY_LIMIT)
        batch = list(q.stream())
        if not batch:
            break
        for snap in batch:
            row = snap.to_dict() or {}
            key = str(row.get("normalized_key") or "")
            if key:
                keys.add(key)
            last_doc = snap
        if len(batch) < _DEDUP_KEY_LIMIT:
            break
        if len(keys) >= 10_000:
            logger.warning("vpm_dedup_keys_hard_cap uid=%s status=%s", uid, status)
            break
    return keys


async def load_dedup_keys(uid: str) -> Tuple[Set[str], Set[str]]:
    def _read():
        accepted = _load_keys_for_status(uid, "accepted")
        rejected = _load_keys_for_status(uid, "rejected")
        if len(accepted) >= 10_000 or len(rejected) >= 10_000:
            logger.warning("vpm_dedup_keys_truncated uid=%s", uid)
        return accepted, rejected

    return await _run_sync(_read)


# --- Claim writes ---


def _pending_payload(
    draft: VerifiedClaimDraft,
    *,
    session_id: str,
    jd_context_hash: Optional[str],
    now: str,
) -> Dict[str, Any]:
    normalized_key = normalize_text(draft.claim_text)
    cid = claim_id_for(draft.claim_category, normalized_key)
    return {
        "claim_id": cid,
        "claim_text": draft.claim_text,
        "claim_category": draft.claim_category,
        "demonstration_strength": draft.demonstration_strength,
        "evidence_quote": draft.evidence_quote,
        "evidence_session_id": session_id,
        "status": "pending",
        "confidence": draft.confidence,
        "normalized_key": normalized_key,
        "extraction_version": EXTRACTION_VERSION,
        "source_type": "interview",
        "jd_context_hash": jd_context_hash,
        "verification_state": "unverified",
        "created_at": now,
        "updated_at": now,
        "_doc_id": cid,
    }


def _batch_upsert_pending_claims(
    uid: str,
    *,
    drafts: List[VerifiedClaimDraft],
    session_id: str,
    jd_context_hash: Optional[str] = None,
) -> List[str]:
    now = _now_iso()
    created_ids: List[str] = []
    batch = db.batch()
    ops = 0
    for draft in drafts:
        normalized_key = normalize_text(draft.claim_text)
        if not normalized_key:
            continue
        cid = claim_id_for(draft.claim_category, normalized_key)
        ref = _claims_collection(uid).document(cid)
        existing = ref.get()
        if existing.exists:
            row = existing.to_dict() or {}
            if row.get("status") == "rejected":
                continue
            if row.get("status") == "accepted":
                batch.set(
                    ref,
                    {
                        "updated_at": now,
                        "evidence_session_id": session_id,
                        "confidence": max(float(row.get("confidence") or 0.0), draft.confidence),
                    },
                    merge=True,
                )
                ops += 1
                continue
            batch.set(
                ref,
                {
                    "claim_text": draft.claim_text,
                    "demonstration_strength": draft.demonstration_strength,
                    "evidence_quote": draft.evidence_quote,
                    "confidence": max(float(row.get("confidence") or 0.0), draft.confidence),
                    "updated_at": now,
                    "evidence_session_id": session_id,
                },
                merge=True,
            )
            created_ids.append(cid)
            ops += 1
            continue
        payload = _pending_payload(draft, session_id=session_id, jd_context_hash=jd_context_hash, now=now)
        doc_id = payload.pop("_doc_id")
        batch.set(ref, payload, merge=False)
        created_ids.append(doc_id)
        ops += 1
        if ops >= 450:
            batch.commit()
            batch = db.batch()
            ops = 0
    if ops:
        batch.commit()
    return created_ids


async def batch_upsert_pending_claims(
    uid: str,
    *,
    drafts: List[VerifiedClaimDraft],
    session_id: str,
    jd_context_hash: Optional[str] = None,
) -> List[str]:
    return await _run_sync(
        _batch_upsert_pending_claims,
        uid,
        drafts=drafts,
        session_id=session_id,
        jd_context_hash=jd_context_hash,
    )


def _refresh_profile_memory_summary(uid: str, limit_per_bucket: int = 12) -> Dict[str, Any]:
    buckets: Dict[str, List[Dict[str, Any]]] = {
        "technical": [],
        "experience": [],
        "behavioral": [],
        "gaps": [],
    }
    accepted_count = 0
    query = (
        _claims_collection(uid)
        .where(filter=firestore.FieldFilter("status", "==", "accepted"))
        .order_by("updated_at", direction=firestore.Query.DESCENDING)
        .limit(200)
    )
    for snap in query.stream():
        row = snap.to_dict() or {}
        accepted_count += 1
        category = str(row.get("claim_category") or "")
        bucket = summary_bucket_key(category)
        if bucket not in buckets or len(buckets[bucket]) >= limit_per_bucket:
            continue
        buckets[bucket].append(
            {
                "claim_id": snap.id,
                "claim_text": row.get("claim_text"),
                "evidence_quote": row.get("evidence_quote"),
                "updated_at": row.get("updated_at"),
                "source_session_id": row.get("evidence_session_id"),
                "demonstration_strength": row.get("demonstration_strength"),
            }
        )
    payload = {
        "schema_version": SCHEMA_VERSION,
        "technical": buckets["technical"],
        "experience": buckets["experience"],
        "behavioral": buckets["behavioral"],
        "gaps": buckets["gaps"],
        "accepted_count": accepted_count,
        "last_refresh": _now_iso(),
    }
    _summary_ref(uid).set(payload, merge=True)
    _counters_ref(uid).set({"accepted_count": accepted_count, "updated_at": _now_iso()}, merge=True)
    return payload


async def refresh_profile_memory_summary(uid: str, limit_per_bucket: int = 12) -> Dict[str, Any]:
    return await _run_sync(_refresh_profile_memory_summary, uid, limit_per_bucket)


async def get_profile_memory_summary(uid: str) -> Dict[str, Any]:
    def _read():
        snap = _summary_ref(uid).get()
        if not snap.exists:
            return {
                "schema_version": SCHEMA_VERSION,
                "technical": [],
                "experience": [],
                "behavioral": [],
                "gaps": [],
                "accepted_count": 0,
            }
        data = snap.to_dict() or {}
        data.setdefault("schema_version", SCHEMA_VERSION)
        for key in ("technical", "experience", "behavioral", "gaps"):
            data.setdefault(key, [])
        data.setdefault("accepted_count", 0)
        return data

    return await _run_sync(_read)


async def list_claims(
    uid: str,
    *,
    status: Optional[str] = None,
    category: Optional[str] = None,
    section: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: int = 40,
) -> List[Dict[str, Any]]:
    def _read():
        q = _claims_collection(uid)
        if status:
            q = q.where(filter=firestore.FieldFilter("status", "==", status))
        if category:
            q = q.where(filter=firestore.FieldFilter("claim_category", "==", category))
        if session_id:
            q = q.where(filter=firestore.FieldFilter("evidence_session_id", "==", session_id))
            limit_local = max(1, min(limit, 200))
            snaps = list(q.limit(limit_local).stream())
            snaps.sort(key=lambda s: str((s.to_dict() or {}).get("updated_at") or ""), reverse=True)
            out: List[Dict[str, Any]] = []
            for snap in snaps:
                row = snap.to_dict() or {}
                if section == "strength" and row.get("claim_category") == GAP_CATEGORY:
                    continue
                if section == "gap" and row.get("claim_category") != GAP_CATEGORY:
                    continue
                row["id"] = snap.id
                out.append(row)
            return out
        q = q.order_by("updated_at", direction=firestore.Query.DESCENDING).limit(max(1, min(limit, 200)))
        out_list: List[Dict[str, Any]] = []
        for snap in q.stream():
            row = snap.to_dict() or {}
            if section == "strength" and row.get("claim_category") == GAP_CATEGORY:
                continue
            if section == "gap" and row.get("claim_category") != GAP_CATEGORY:
                continue
            row["id"] = snap.id
            out_list.append(row)
        return out_list

    return await _run_sync(_read)


async def get_claim(uid: str, claim_id: str) -> Optional[Dict[str, Any]]:
    def _read():
        snap = _claims_collection(uid).document(claim_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        data["id"] = snap.id
        return data

    return await _run_sync(_read)


def _update_claim_status_txn(uid: str, claim_id: str, status: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if status not in {"accepted", "rejected", "archived"}:
        raise ValueError("invalid_status")
    claim_ref = _claims_collection(uid).document(claim_id)
    counters_ref = _counters_ref(uid)

    @db.transaction
    def _txn(transaction):
        claim_snap = claim_ref.get(transaction=transaction)
        if not claim_snap.exists:
            return None, "not_found"
        row = claim_snap.to_dict() or {}
        prev_status = str(row.get("status") or "")
        if prev_status == status:
            data = dict(row)
            data["id"] = claim_id
            return data, None
        counters_snap = counters_ref.get(transaction=transaction)
        counters = counters_snap.to_dict() if counters_snap.exists else {}
        accepted_count = int(counters.get("accepted_count") or 0)
        pending_count = int(counters.get("pending_count") or 0)
        rejected_count = int(counters.get("rejected_count") or 0)
        if status == "accepted" and prev_status != "accepted":
            if accepted_count >= get_max_accepted():
                return None, "cap_exceeded"
        now = _now_iso()
        patch: Dict[str, Any] = {"status": status, "updated_at": now}
        if status == "accepted":
            patch["accepted_at"] = now
            patch["verification_state"] = "verified"
            patch["last_verified_at"] = now
        elif status == "rejected":
            patch["rejected_at"] = now
        transaction.update(claim_ref, patch)

        def _dec(s: str) -> None:
            nonlocal accepted_count, pending_count, rejected_count
            field = _status_counter_field(s)
            if field == "accepted_count":
                accepted_count = max(0, accepted_count - 1)
            elif field == "pending_count":
                pending_count = max(0, pending_count - 1)
            elif field == "rejected_count":
                rejected_count = max(0, rejected_count - 1)

        def _inc(s: str) -> None:
            nonlocal accepted_count, pending_count, rejected_count
            field = _status_counter_field(s)
            if field == "accepted_count":
                accepted_count += 1
            elif field == "pending_count":
                pending_count += 1
            elif field == "rejected_count":
                rejected_count += 1

        if prev_status:
            _dec(prev_status)
        _inc(status)
        transaction.set(
            counters_ref,
            {
                "accepted_count": accepted_count,
                "pending_count": pending_count,
                "rejected_count": rejected_count,
                "updated_at": now,
            },
            merge=True,
        )
        data = {**row, **patch, "id": claim_id}
        return data, None

    transaction = db.transaction()
    return _txn(transaction)


async def update_claim_status(
    uid: str,
    claim_id: str,
    status: str,
    *,
    refresh_summary: bool = True,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    result = await _run_sync(_update_claim_status_txn, uid, claim_id, status)
    if refresh_summary and result[0] is not None and result[1] is None:
        await refresh_profile_memory_summary(uid)
    return result


async def resolve_session_access(session_id: str, uid: str) -> SessionAccess:
    """Return whether uid may read profile claims for session_id."""

    def _read() -> SessionAccess:
        doc = db.collection("interviews").document(session_id).get()
        if doc.exists:
            owner = str((doc.to_dict() or {}).get("user_id") or "")
            return "owned" if owner == uid else "forbidden"
        from services.profile_memory.pipeline_state import _pipeline_run_ref

        run = _pipeline_run_ref(uid, session_id).get()
        if run.exists:
            return "owned"
        return "not_found"

    return await _run_sync(_read)
