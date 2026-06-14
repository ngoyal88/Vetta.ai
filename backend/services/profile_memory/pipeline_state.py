from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from config import get_settings
from firebase_config import db
from utils.logger import get_logger

logger = get_logger("PipelineState")

PIPELINE_STATUSES = frozenset({"queued", "running", "completed", "failed", "skipped"})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pipeline_run_ref(uid: str, session_id: str):
    return db.collection("users").document(uid).collection("pipeline_runs").document(session_id)


def _parse_iso(value: Any) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _lease_seconds() -> int:
    return int(getattr(get_settings(), "vpm_pipeline_lease_seconds", 600))


def acquire_pipeline_run(uid: str, session_id: str) -> Tuple[bool, str]:
    """
    Transactional run lock. Returns (acquired, reason).
    reason: acquired | already_completed | lock_held | skipped_terminal
    """
    ref = _pipeline_run_ref(uid, session_id)
    lease = _lease_seconds()
    now = _now_iso()
    now_dt = datetime.now(timezone.utc)

    @db.transaction
    def _txn(transaction):
        snap = ref.get(transaction=transaction)
        if snap.exists:
            row = snap.to_dict() or {}
            status = str(row.get("status") or "")
            if status == "completed":
                return False, "already_completed"
            if status == "skipped":
                return False, "already_completed"
            if status == "running":
                started = _parse_iso(row.get("started_at"))
                if started and (now_dt - started).total_seconds() < lease:
                    return False, "lock_held"
                attempt = int(row.get("attempt") or 0) + 1
            else:
                attempt = int(row.get("attempt") or 0) + 1
        else:
            attempt = 1

        transaction.set(
            ref,
            {
                "status": "running",
                "session_id": session_id,
                "attempt": attempt,
                "started_at": now,
                "updated_at": now,
                "finished_at": None,
                "error_code": None,
                "error_message": None,
            },
            merge=True,
        )
        return True, "acquired"

    transaction = db.transaction()
    return _txn(transaction)


def mark_pipeline_terminal(
    uid: str,
    session_id: str,
    *,
    status: str,
    stats: Optional[Dict[str, Any]] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    if status not in PIPELINE_STATUSES:
        raise ValueError(f"invalid pipeline status: {status}")
    payload: Dict[str, Any] = {
        "status": status,
        "session_id": session_id,
        "updated_at": _now_iso(),
        "finished_at": _now_iso(),
    }
    if stats is not None:
        payload["stats"] = stats
    if error_code:
        payload["error_code"] = error_code
    if error_message:
        payload["error_message"] = str(error_message)[:500]
    _pipeline_run_ref(uid, session_id).set(payload, merge=True)


def get_pipeline_status(uid: str, session_id: str) -> Dict[str, Any]:
    snap = _pipeline_run_ref(uid, session_id).get()
    if not snap.exists:
        return {
            "pipeline_status": "running",
            "pipeline_stats": None,
            "pipeline_error": None,
        }
    row = snap.to_dict() or {}
    status = str(row.get("status") or "running")
    error = None
    if status == "failed":
        error = {
            "code": row.get("error_code"),
            "message": row.get("error_message"),
        }
    return {
        "pipeline_status": status,
        "pipeline_stats": row.get("stats"),
        "pipeline_error": error,
        "attempt": row.get("attempt"),
        "started_at": row.get("started_at"),
        "finished_at": row.get("finished_at"),
    }
