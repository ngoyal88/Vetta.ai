from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import hashlib
import re

from firebase_admin import firestore

from firebase_config import db
from services.interview.prompt_contracts import execute_json_contract
from utils.logger import get_logger

logger = get_logger("CandidateEnrichmentService")

AUTO_ACCEPT_THRESHOLD = 0.85
MAX_ENRICHMENTS_PER_SESSION = 8


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_text(value: str) -> str:
    text = re.sub(r"\s+", " ", (value or "").strip().lower())
    text = re.sub(r"[^a-z0-9 +#._-]", "", text)
    return text


def _enrichment_id(kind: str, normalized_value: str) -> str:
    digest = hashlib.sha1(f"{kind}:{normalized_value}".encode("utf-8")).hexdigest()[:16]
    return f"{kind}_{digest}"


def _enrichment_collection(uid: str):
    return db.collection("users").document(uid).collection("candidate_enrichments")


def _enrichment_summary_ref(uid: str):
    return db.collection("users").document(uid).collection("candidate_profile_memory").document("summary")


def _extract_resume_known_items(resume_data: Dict[str, Any]) -> Dict[str, set[str]]:
    known_projects: set[str] = set()
    known_skills: set[str] = set()
    if not isinstance(resume_data, dict):
        return {"projects": known_projects, "skills": known_skills}

    raw_projects = resume_data.get("projects") or []
    for p in raw_projects:
        if isinstance(p, dict):
            name = str(p.get("name") or "").strip()
            if name:
                known_projects.add(_normalize_text(name))
        elif isinstance(p, str) and p.strip():
            known_projects.add(_normalize_text(p))

    raw_skills = resume_data.get("skills")
    if isinstance(raw_skills, dict):
        for values in raw_skills.values():
            if isinstance(values, list):
                for skill in values:
                    if isinstance(skill, str) and skill.strip():
                        known_skills.add(_normalize_text(skill))
    elif isinstance(raw_skills, list):
        for skill in raw_skills:
            if isinstance(skill, str) and skill.strip():
                known_skills.add(_normalize_text(skill))
            elif isinstance(skill, dict):
                name = str(skill.get("name") or "").strip()
                if name:
                    known_skills.add(_normalize_text(name))

    return {"projects": known_projects, "skills": known_skills}


def _normalize_candidates(parsed: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not isinstance(parsed, dict):
        return out
    for kind_key, canonical in (
        ("projects", "project"),
        ("skills", "skill"),
        ("soft_signals", "soft_signal"),
    ):
        rows = parsed.get(kind_key)
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            value = str(row.get("value") or "").strip()
            if not value:
                continue
            confidence_raw = row.get("confidence")
            try:
                confidence = float(confidence_raw)
            except Exception:
                confidence = 0.5
            confidence = max(0.0, min(confidence, 1.0))
            evidence = str(row.get("evidence") or "").strip()[:500]
            out.append(
                {
                    "type": canonical,
                    "value": value[:220],
                    "confidence": confidence,
                    "evidence": evidence,
                }
            )
    return out


async def refresh_enrichment_summary(uid: str, limit_per_type: int = 12) -> Dict[str, Any]:
    accepted = (
        _enrichment_collection(uid)
        .where(filter=firestore.FieldFilter("status", "==", "accepted"))
        .order_by("updated_at", direction=firestore.Query.DESCENDING)
        .limit(200)
        .stream()
    )
    buckets: Dict[str, List[Dict[str, Any]]] = {"project": [], "skill": [], "soft_signal": []}
    for snap in accepted:
        row = snap.to_dict() or {}
        kind = str(row.get("type") or "")
        if kind not in buckets:
            continue
        if len(buckets[kind]) >= limit_per_type:
            continue
        buckets[kind].append(
            {
                "value": row.get("value"),
                "confidence": row.get("confidence"),
                "updated_at": row.get("updated_at"),
                "source_session_id": row.get("source_session_id"),
            }
        )
    payload = {
        "projects": buckets["project"],
        "skills": buckets["skill"],
        "soft_signals": buckets["soft_signal"],
        "last_refresh": _now_iso(),
    }
    _enrichment_summary_ref(uid).set(payload, merge=True)
    return payload


async def get_enrichment_summary(uid: str) -> Dict[str, Any]:
    snap = _enrichment_summary_ref(uid).get()
    if not snap.exists:
        return {"projects": [], "skills": [], "soft_signals": []}
    data = snap.to_dict() or {}
    data.setdefault("projects", [])
    data.setdefault("skills", [])
    data.setdefault("soft_signals", [])
    return data


async def list_enrichments(uid: str, *, status: Optional[str] = None, limit: int = 40) -> List[Dict[str, Any]]:
    q = _enrichment_collection(uid)
    if status:
        q = q.where(filter=firestore.FieldFilter("status", "==", status))
    q = q.order_by("updated_at", direction=firestore.Query.DESCENDING).limit(max(1, min(limit, 200)))
    out: List[Dict[str, Any]] = []
    for snap in q.stream():
        row = snap.to_dict() or {}
        row["id"] = snap.id
        out.append(row)
    return out


async def update_enrichment_status(uid: str, enrichment_id: str, status: str) -> Optional[Dict[str, Any]]:
    if status not in {"accepted", "rejected"}:
        raise ValueError("status must be accepted or rejected")
    ref = _enrichment_collection(uid).document(enrichment_id)
    snap = ref.get()
    if not snap.exists:
        return None
    now = _now_iso()
    patch: Dict[str, Any] = {"status": status, "updated_at": now}
    if status == "accepted":
        patch["accepted_at"] = now
    else:
        patch["rejected_at"] = now
    ref.set(patch, merge=True)
    await refresh_enrichment_summary(uid)
    data = (ref.get().to_dict() or {})
    data["id"] = enrichment_id
    return data


async def run_enrichment_pipeline(
    *,
    uid: str,
    session_id: str,
    session_data: Dict[str, Any],
    engine: Any,
) -> Dict[str, Any]:
    resume_data = session_data.get("resume_data") or {}
    known = _extract_resume_known_items(resume_data if isinstance(resume_data, dict) else {})
    transcript = session_data.get("live_transcription") or []
    responses = session_data.get("responses") or []
    code_submissions = session_data.get("code_submissions") or []
    transcript_blob = "\n".join(
        f"{str(x.get('speaker') or x.get('role') or '')}: {str(x.get('text') or '')[:240]}"
        for x in transcript[:80]
        if isinstance(x, dict)
    )
    qa_blob = "\n".join(
        f"Q: {str((r.get('question') or {}).get('question') if isinstance(r.get('question'), dict) else r.get('question') or '')[:220]}\nA: {str(r.get('response') or '')[:260]}"
        for r in responses[:40]
        if isinstance(r, dict)
    )
    code_blob = "\n".join(str(c.get("code") or "")[:220] for c in code_submissions[:6] if isinstance(c, dict))

    prompt = f"""Extract candidate profile enrichments not already in resume profile.
Return ONLY valid JSON:
{{
  "projects": [{{"value":"string","confidence":0.0,"evidence":"string"}}],
  "skills": [{{"value":"string","confidence":0.0,"evidence":"string"}}],
  "soft_signals": [{{"value":"string","confidence":0.0,"evidence":"string"}}]
}}

Rules:
- Focus only on concrete interview evidence.
- Suggest new items (not obvious duplicates of existing resume profile).
- Keep each value concise.

Existing Resume (skills/projects):
{resume_data}

Interview transcript:
{transcript_blob}

Interview Q/A:
{qa_blob}

Code behavior:
{code_blob}
"""
    contract = await execute_json_contract(
        template_id="candidate_enrichment_extract",
        engine=engine,
        prompt=prompt,
        temperature=0.2,
        fallback={"projects": [], "skills": [], "soft_signals": []},
        normalizer=lambda p: p if isinstance(p, dict) else {"projects": [], "skills": [], "soft_signals": []},
        empty_fallback="{}",
    )
    candidates = _normalize_candidates(contract.value)[:MAX_ENRICHMENTS_PER_SESSION]
    created = 0
    accepted = 0
    pending = 0
    skipped = 0
    now = _now_iso()
    for candidate in candidates:
        kind = candidate["type"]
        value = candidate["value"]
        normalized_value = _normalize_text(value)
        if not normalized_value:
            skipped += 1
            continue
        if kind == "project" and normalized_value in known["projects"]:
            skipped += 1
            continue
        if kind == "skill" and normalized_value in known["skills"]:
            skipped += 1
            continue

        eid = _enrichment_id(kind, normalized_value)
        ref = _enrichment_collection(uid).document(eid)
        existing = ref.get()
        if existing.exists:
            row = existing.to_dict() or {}
            if row.get("status") == "rejected":
                skipped += 1
                continue
            ref.set(
                {
                    "value": value,
                    "confidence": max(float(row.get("confidence") or 0.0), candidate["confidence"]),
                    "evidence": candidate["evidence"] or row.get("evidence"),
                    "updated_at": now,
                    "source_session_id": session_id,
                },
                merge=True,
            )
            continue

        status = "accepted" if candidate["confidence"] >= AUTO_ACCEPT_THRESHOLD else "pending"
        payload = {
            "type": kind,
            "value": value,
            "normalized_value": normalized_value,
            "status": status,
            "confidence": candidate["confidence"],
            "evidence": candidate["evidence"],
            "source_session_id": session_id,
            "created_at": now,
            "updated_at": now,
            "auto_accepted": status == "accepted",
        }
        if status == "accepted":
            payload["accepted_at"] = now
            accepted += 1
        else:
            pending += 1
        ref.set(payload, merge=False)
        created += 1

    await refresh_enrichment_summary(uid)
    result = {
        "created": created,
        "accepted": accepted,
        "pending": pending,
        "skipped": skipped,
        "ok": contract.ok,
    }
    logger.info("enrichment_pipeline_complete uid=%s session=%s result=%s", uid, session_id, result)
    return result
