from __future__ import annotations

import hashlib
import time
from typing import Any, Dict, List, Optional

from config import get_settings
from services.profile_memory.models import GAP_CATEGORY
from services.profile_memory.pipeline_state import acquire_pipeline_run
from services.profile_memory.profile_claims_extract import extract_claims
from services.profile_memory.profile_claims_gate import apply_gate
from services.profile_memory.profile_claims_repository import (
    batch_upsert_pending_claims,
    get_pipeline_status_async,
    list_claims,
    load_dedup_keys,
    mark_pipeline_completed,
    mark_pipeline_failed,
    mark_pipeline_skipped,
    refresh_profile_memory_summary,
    update_claim_status,
)
from services.profile_memory.profile_claims_verify import verify_claims_batch
from services.profile_memory.resume_known import extract_resume_known_items
from services.profile_memory.umbrella_terms import normalize_text
from utils.logger import get_logger

logger = get_logger("ProfileClaimsService")


def _jd_context_hash(jd_fit_context: Any, job_description: str) -> Optional[str]:
    jd_text = (job_description or "").strip()
    if jd_text:
        return hashlib.sha1(jd_text.lower().encode("utf-8")).hexdigest()[:16]
    if isinstance(jd_fit_context, dict) and jd_fit_context.get("summary"):
        return hashlib.sha1(str(jd_fit_context.get("summary")).encode("utf-8")).hexdigest()[:16]
    return None


def _candidate_transcript_chars(session_data: Dict[str, Any]) -> int:
    total = 0
    transcript = session_data.get("live_transcription") or []
    if isinstance(transcript, list):
        for entry in transcript:
            if not isinstance(entry, dict):
                continue
            speaker = str(entry.get("speaker") or entry.get("role") or "").lower()
            if speaker not in {"candidate", "user"}:
                continue
            total += len(str(entry.get("text") or ""))
    responses = session_data.get("responses") or []
    if isinstance(responses, list):
        for row in responses:
            if isinstance(row, dict):
                total += len(str(row.get("response") or ""))
    return total


def build_transcript_corpus(session_data: Dict[str, Any]) -> str:
    parts: List[str] = []
    transcript = session_data.get("live_transcription") or []
    if isinstance(transcript, list):
        for entry in transcript:
            if not isinstance(entry, dict):
                continue
            speaker = str(entry.get("speaker") or entry.get("role") or "").lower()
            if speaker in {"candidate", "user"}:
                parts.append(str(entry.get("text") or ""))
    responses = session_data.get("responses") or []
    if isinstance(responses, list):
        for row in responses:
            if isinstance(row, dict):
                parts.append(str(row.get("response") or ""))
    return normalize_text(" ".join(parts))


def should_run_pipeline(session_data: Dict[str, Any]) -> tuple[bool, str]:
    responses = session_data.get("responses") or []
    response_count = len(responses) if isinstance(responses, list) else 0
    candidate_chars = _candidate_transcript_chars(session_data)
    duration = session_data.get("duration_minutes")
    try:
        duration_minutes = int(duration) if duration is not None else 0
    except (TypeError, ValueError):
        duration_minutes = 0
    if response_count >= 2:
        return True, "responses"
    if candidate_chars >= 500:
        return True, "transcript_chars"
    if duration_minutes >= 3 and candidate_chars >= 120:
        return True, "duration"
    return False, "insufficient_evidence"


def _build_blobs(session_data: Dict[str, Any]) -> tuple[str, str, str]:
    transcript = session_data.get("live_transcription") or []
    responses = session_data.get("responses") or []
    code_submissions = session_data.get("code_submissions") or []
    transcript_blob = "\n".join(
        f"{str(x.get('speaker') or x.get('role') or '')}: {str(x.get('text') or '')[:240]}"
        for x in transcript[:80]
        if isinstance(x, dict)
    )
    qa_blob = "\n".join(
        (
            f"Q: {str((r.get('question') or {}).get('question') if isinstance(r.get('question'), dict) else r.get('question') or '')[:220]}\n"
            f"A: {str(r.get('response') or '')[:260]}"
        )
        for r in responses[:40]
        if isinstance(r, dict)
    )
    code_blob = "\n".join(str(c.get("code") or "")[:220] for c in code_submissions[:6] if isinstance(c, dict))
    return transcript_blob, qa_blob, code_blob


async def run_profile_claims_pipeline(
    *,
    uid: str,
    session_id: str,
    session_data: Dict[str, Any],
    engine: Any,
) -> Dict[str, Any]:
    settings = get_settings()
    started_ms = time.monotonic()
    if not getattr(settings, "vpm_enabled", True):
        return {"skipped": True, "reason": "vpm_disabled", "pipeline_status": "skipped"}
    if not uid or str(uid).strip() == "":
        return {"skipped": True, "reason": "missing_uid", "pipeline_status": "skipped"}
    session_uid = str(session_data.get("user_id") or "")
    if session_uid and session_uid != uid:
        logger.warning("vpm_pipeline_uid_mismatch session=%s", session_id)
        return {"skipped": True, "reason": "uid_mismatch", "pipeline_status": "skipped"}
    acquired, lock_reason = await _run_sync_acquire(uid, session_id)
    if not acquired:
        if lock_reason == "already_completed":
            status = await get_pipeline_status_async(uid, session_id)
            return {
                "skipped": True,
                "reason": "already_completed",
                "pipeline_status": status.get("pipeline_status", "completed"),
                "stats": status.get("pipeline_stats"),
            }
        return {"skipped": True, "reason": lock_reason, "pipeline_status": "running"}
    stats: Dict[str, Any] = {
        "gate_discard_by_reason": {},
        "extract_ok": False,
        "verify_ok": False,
    }
    try:
        should_run, run_reason = should_run_pipeline(session_data)
        if not should_run:
            logger.info("vpm_pipeline_skipped uid=%s session=%s reason=%s", uid, session_id, run_reason)
            stats.update(
                {
                    "skipped": True,
                    "reason": run_reason,
                    "pending_strength": 0,
                    "pending_gap": 0,
                    "discarded": 0,
                    "duration_ms": int((time.monotonic() - started_ms) * 1000),
                }
            )
            await mark_pipeline_skipped(uid, session_id, stats)
            return {"skipped": True, "reason": run_reason, "pipeline_status": "skipped", "stats": stats}
        resume_data = session_data.get("resume_data") or {}
        if not isinstance(resume_data, dict):
            resume_data = {}
        resume_known = extract_resume_known_items(resume_data)
        accepted_keys, rejected_keys = await load_dedup_keys(uid)
        transcript_normalized = build_transcript_corpus(session_data)
        transcript_blob, qa_blob, code_blob = _build_blobs(session_data)
        jd_fit_context = session_data.get("jd_fit_context") or {}
        if not isinstance(jd_fit_context, dict):
            jd_fit_context = {}
        jd_hash = _jd_context_hash(jd_fit_context, str(session_data.get("job_description") or ""))
        target_role = str(session_data.get("target_role") or session_data.get("custom_role") or "")
        max_raw = int(getattr(settings, "vpm_max_raw_extract", 8))
        raw_claims, extract_ok = await extract_claims(
            engine=engine,
            resume_data=resume_data,
            transcript_blob=transcript_blob,
            qa_blob=qa_blob,
            code_blob=code_blob,
            jd_fit_context=jd_fit_context,
            max_raw=max_raw,
            target_role=target_role,
        )
        stats["extract_ok"] = extract_ok
        if not extract_ok:
            stats["duration_ms"] = int((time.monotonic() - started_ms) * 1000)
            await mark_pipeline_failed(
                uid,
                session_id,
                error_code="extract_failed",
                error_message="LLM extract contract failed",
                stats=stats,
            )
            return {"failed": True, "reason": "extract_failed", "pipeline_status": "failed", "stats": stats}
        gated = []
        discarded = 0
        discard_reasons: Dict[str, int] = {}
        for claim in raw_claims:
            gate = apply_gate(
                claim,
                resume_known=resume_known,
                rejected_keys=rejected_keys,
                accepted_keys=accepted_keys,
                transcript_normalized=transcript_normalized,
            )
            if gate.passed:
                gated.append(claim)
            else:
                discarded += 1
                reason = gate.reason or "unknown"
                discard_reasons[reason] = discard_reasons.get(reason, 0) + 1
                logger.info(
                    "vpm_gate_discard uid=%s session=%s reason=%s claim=%s",
                    uid,
                    session_id,
                    reason,
                    claim.claim_text[:80],
                )
        transcript_context = f"{transcript_blob}\n\n{qa_blob}"
        verify_result = await verify_claims_batch(
            engine=engine,
            claims=gated,
            transcript_context=transcript_context,
            transcript_normalized=transcript_normalized,
        )
        stats["verify_ok"] = verify_result.verify_ok
        if verify_result.degraded:
            stats["verify_degraded"] = True
            stats["verify_chunks_failed"] = verify_result.chunks_failed
        verified = verify_result.approved
        created_ids = await batch_upsert_pending_claims(
            uid,
            drafts=verified,
            session_id=session_id,
            jd_context_hash=jd_hash,
        )
        pending_strength = sum(1 for d in verified if d.claim_category != GAP_CATEGORY)
        pending_gap = sum(1 for d in verified if d.claim_category == GAP_CATEGORY)
        await refresh_profile_memory_summary(uid)
        stats.update(
            {
                "raw": len(raw_claims),
                "gated": len(gated),
                "verified": len(verified),
                "pending_strength": pending_strength,
                "pending_gap": pending_gap,
                "discarded": discarded,
                "gate_discard_by_reason": discard_reasons,
                "created_ids": created_ids,
                "run_reason": run_reason,
                "duration_ms": int((time.monotonic() - started_ms) * 1000),
            }
        )
        await mark_pipeline_completed(uid, session_id, stats)
        logger.info("vpm_pipeline_complete uid=%s session=%s stats=%s", uid, session_id, stats)
        return {"pipeline_status": "completed", "stats": stats}
    except Exception as exc:
        logger.warning("vpm_pipeline_failed uid=%s session=%s err=%s", uid, session_id, exc, exc_info=True)
        stats["duration_ms"] = int((time.monotonic() - started_ms) * 1000)
        await mark_pipeline_failed(
            uid,
            session_id,
            error_code="internal",
            error_message=str(exc)[:500],
            stats=stats,
        )
        return {"failed": True, "reason": "internal", "pipeline_status": "failed", "stats": stats}


async def _run_sync_acquire(uid: str, session_id: str) -> tuple[bool, str]:
    import asyncio

    return await asyncio.to_thread(acquire_pipeline_run, uid, session_id)


async def get_session_claims(uid: str, session_id: str) -> Dict[str, Any]:
    """Load session claims; caller must verify access via resolve_session_access first."""
    pipeline = await get_pipeline_status_async(uid, session_id)
    items = await list_claims(uid, session_id=session_id, limit=50)
    strength = [row for row in items if row.get("claim_category") != GAP_CATEGORY]
    gaps = [row for row in items if row.get("claim_category") == GAP_CATEGORY]
    return {
        "items": items,
        "strength": strength,
        "gaps": gaps,
        "session_id": session_id,
        "pipeline_status": pipeline.get("pipeline_status"),
        "pipeline_stats": pipeline.get("pipeline_stats"),
        "pipeline_error": pipeline.get("pipeline_error"),
    }


async def bulk_update_claims(uid: str, items: List[Dict[str, str]]) -> Dict[str, Any]:
    out = []
    errors = []
    changed = False
    for item in items[:100]:
        claim_id = str(item.get("claim_id") or "")
        status = str(item.get("status") or "")
        if status not in {"accepted", "rejected"}:
            continue
        row, err = await update_claim_status(uid, claim_id, status, refresh_summary=False)
        if err == "cap_exceeded":
            errors.append({"claim_id": claim_id, "error": err})
            continue
        if row:
            out.append(row)
            changed = True
    if changed:
        await refresh_profile_memory_summary(uid)
    return {"items": out, "count": len(out), "errors": errors}
