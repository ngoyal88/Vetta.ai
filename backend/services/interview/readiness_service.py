from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from firebase_admin import firestore

from firebase_config import db
from services.profile_memory.profile_claims_repository import get_profile_memory_summary
from services.vault.analysis_service import build_vault_scorecard
from services.vault.vault_service import get_vault_entry, get_vault_meta, get_version_by_id
from utils.logger import get_logger

logger = get_logger("ReadinessService")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _jd_hash(job_description: str) -> str:
    # ponytail: JD hash is presence-only fingerprint, not semantic scoring
    text = (job_description or "").strip().lower()
    if not text:
        return "none"
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


def _serialize_ts(value: Any) -> Optional[str]:
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
            return None
    return None


def _clamp_score(value: float) -> int:
    return max(0, min(100, int(round(value))))


async def _load_resume_snapshot(
    uid: str,
    resume_id: Optional[str] = None,
    version_id: Optional[str] = None,
) -> Tuple[Dict[str, Any], Optional[str], Optional[str]]:
    selected_resume_id = (resume_id or "").strip() or None
    selected_version_id = (version_id or "").strip() or None

    if selected_resume_id and not selected_version_id:
        entry = await get_vault_entry(uid, selected_resume_id)
        if not entry:
            return {}, None, None
        selected_version_id = entry.get("current_version_id")
    elif not selected_resume_id:
        meta = await get_vault_meta(uid)
        active_resume_id = meta.get("active_resume_id")
        if active_resume_id:
            entry = await get_vault_entry(uid, active_resume_id)
            if entry:
                selected_resume_id = active_resume_id
                selected_version_id = entry.get("current_version_id")

    if not selected_version_id:
        return {}, selected_resume_id, None

    version = await get_version_by_id(uid, selected_version_id)
    if not version:
        return {}, selected_resume_id, None
    resume_profile = version.get("profile_snapshot")
    if not isinstance(resume_profile, dict):
        resume_profile = {}
    if not selected_resume_id:
        selected_resume_id = version.get("resume_id")
    return resume_profile, selected_resume_id, selected_version_id


def _extract_interview_rows(uid: str, limit: int = 20) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    docs = (
        db.collection("interviews")
        .where("user_id", "==", uid)
        .limit(max(1, min(limit, 50)))
        .stream()
    )
    for doc in docs:
        payload = doc.to_dict() or {}
        payload["id"] = doc.id
        rows.append(payload)
    rows.sort(
        key=lambda item: str(item.get("completed_at") or item.get("last_updated") or item.get("started_at") or ""),
        reverse=True,
    )
    return rows[:limit]


def _claim_texts(bucket: Any) -> List[str]:
    if not isinstance(bucket, list):
        return []
    out: List[str] = []
    for entry in bucket:
        if isinstance(entry, dict):
            text = str(entry.get("claim_text") or "").strip()
            if text:
                out.append(text)
    return out


def _dimension_scores(
    *,
    vault_score: int,
    role_fit_score: Optional[int],
    coverage_counts: Dict[str, Any],
    profile_memory: Dict[str, Any],
    interviews: List[Dict[str, Any]],
    jd_present: bool,
) -> Dict[str, int]:
    technical_claims = _claim_texts(profile_memory.get("technical"))
    experience_claims = _claim_texts(profile_memory.get("experience"))
    behavioral_claims = _claim_texts(profile_memory.get("behavioral"))
    gap_claims = _claim_texts(profile_memory.get("gaps"))
    coverage_skill_count = int(coverage_counts.get("skills") or 0)
    coverage_projects = int(coverage_counts.get("projects") or 0)
    coverage_work = int(coverage_counts.get("work_experiences") or 0)

    role_anchor = role_fit_score if isinstance(role_fit_score, int) else vault_score
    skills = _clamp_score(
        0.65 * role_anchor
        + 2.5 * min(6, len(technical_claims))
        + 1.2 * min(12, coverage_skill_count)
    )
    experience = _clamp_score(
        35
        + min(35, coverage_work * 12)
        + min(20, coverage_projects * 6)
        + min(10, len(experience_claims) * 2)
    )

    scored_sessions = []
    evidence_sessions = 0
    for row in interviews:
        scores = row.get("scores") if isinstance(row.get("scores"), dict) else {}
        overall = scores.get("overall")
        if isinstance(overall, (int, float)):
            scored_sessions.append(float(overall))
        if row.get("questions_answered") or row.get("code_problems_attempted"):
            evidence_sessions += 1

    avg_overall_10 = (sum(scored_sessions) / len(scored_sessions)) if scored_sessions else 5.2
    communication = _clamp_score(avg_overall_10 * 10)
    verified_claim_count = len(technical_claims) + len(experience_claims) + len(behavioral_claims)
    evidence = _clamp_score(
        30
        + min(25, evidence_sessions * 5)
        + min(20, len(behavioral_claims) * 4)
        + min(20, verified_claim_count * 2)
        + (5 if jd_present else 0)
        - min(8, len(gap_claims))
    )

    return {
        "skills": skills,
        "experience": experience,
        "communication": communication,
        "evidence": evidence,
    }


def _derive_gaps_and_actions(
    breakdown: Dict[str, int],
    jd_present: bool,
    profile_memory: Dict[str, Any],
) -> Tuple[List[str], List[str], str]:
    ordered = sorted(breakdown.items(), key=lambda item: item[1])
    top_gaps: List[str] = []
    next_actions: List[str] = []

    accepted_gaps = _claim_texts(profile_memory.get("gaps"))
    if accepted_gaps:
        top_gaps.extend(accepted_gaps[:3])
        next_actions.append("Practice the open gap topics in a role-targeted mock interview.")

    for key, score in ordered[:3]:
        if len(top_gaps) >= 3:
            break
        if key == "skills":
            top_gaps.append("Technical claim depth is lower than target role expectations.")
            next_actions.append("Verify more technical claims with specific metrics in your next mock.")
        elif key == "experience":
            top_gaps.append("Experience evidence lacks quantified scope or ownership.")
            next_actions.append("Rewrite recent work bullets with measurable outcomes and tradeoff details.")
        elif key == "communication":
            top_gaps.append("Interview communication consistency is below target benchmark.")
            next_actions.append("Run one focused behavioral mock and improve answer structure.")
        elif key == "evidence":
            top_gaps.append("Supporting evidence for claims is sparse across sessions.")
            next_actions.append("Review pending verified claims after your next interview.")

    if jd_present:
        next_actions.append("Use the same JD again after updates to track readiness delta precisely.")
    else:
        next_actions.append("Provide a target JD for tighter role-specific scoring.")

    strongest_dim, strongest_score = max(breakdown.items(), key=lambda item: item[1])
    weakest_dim, weakest_score = min(breakdown.items(), key=lambda item: item[1])
    cite_pool = (
        _claim_texts(profile_memory.get("technical"))
        + _claim_texts(profile_memory.get("experience"))
    )
    cite = f' Verified strengths include "{cite_pool[0]}".' if cite_pool else ""
    why = (
        f"Your strongest area is {strongest_dim} ({strongest_score}/100), while {weakest_dim} "
        f"({weakest_score}/100) is pulling your readiness down.{cite}"
    )
    return top_gaps[:3], next_actions[:3], why


def _readiness_collection(uid: str):
    return db.collection("users").document(uid).collection("readiness_snapshots")


async def compute_readiness(
    *,
    uid: str,
    target_role: str,
    job_description: str = "",
    resume_id: Optional[str] = None,
    version_id: Optional[str] = None,
) -> Dict[str, Any]:
    profile, selected_resume_id, selected_version_id = await _load_resume_snapshot(
        uid, resume_id=resume_id, version_id=version_id
    )

    scorecard = await build_vault_scorecard(profile, role=target_role) if profile else None
    vault_score = int(scorecard.score) if scorecard else 40
    role_fit_score = int(scorecard.role_fit_score) if scorecard and scorecard.role_fit_score is not None else None
    coverage_counts = (scorecard.coverage_counts or {}) if scorecard else {}

    profile_memory = await get_profile_memory_summary(uid)
    interviews = _extract_interview_rows(uid, limit=20)
    jd_present = bool((job_description or "").strip())

    breakdown = _dimension_scores(
        vault_score=vault_score,
        role_fit_score=role_fit_score,
        coverage_counts=coverage_counts,
        profile_memory=profile_memory,
        interviews=interviews,
        jd_present=jd_present,
    )
    overall = _clamp_score(
        0.36 * breakdown["skills"]
        + 0.24 * breakdown["experience"]
        + 0.22 * breakdown["communication"]
        + 0.18 * breakdown["evidence"]
    )
    top_gaps, next_actions, why = _derive_gaps_and_actions(
        breakdown, jd_present=jd_present, profile_memory=profile_memory
    )
    jd_digest = _jd_hash(job_description)
    inputs_hash = hashlib.sha1(
        (
            f"{uid}|{target_role.strip().lower()}|{jd_digest}|{selected_resume_id or ''}|"
            f"{selected_version_id or ''}|{len(interviews)}|{breakdown['skills']}|{breakdown['communication']}"
        ).encode("utf-8")
    ).hexdigest()[:16]

    computed_at = _now_iso()
    snapshot = {
        "target_role": target_role.strip(),
        "jd_hash": jd_digest,
        "overall_score": overall,
        "breakdown": breakdown,
        "why_this_score": why,
        "top_gaps": top_gaps,
        "next_actions": next_actions,
        "computed_at": computed_at,
        "inputs_hash": inputs_hash,
        "resume_id": selected_resume_id,
        "version_id": selected_version_id,
        "source": {
            "interview_count": len(interviews),
            "claim_counts": {
                "technical": len(profile_memory.get("technical") or []),
                "experience": len(profile_memory.get("experience") or []),
                "behavioral": len(profile_memory.get("behavioral") or []),
                "gaps": len(profile_memory.get("gaps") or []),
                "accepted_total": int(profile_memory.get("accepted_count") or 0),
            },
        },
        "created_at": firestore.SERVER_TIMESTAMP,
    }
    _readiness_collection(uid).add(snapshot)
    snapshot.pop("created_at", None)
    return snapshot


async def get_readiness_history(
    *,
    uid: str,
    target_role: str,
    job_description: str = "",
    limit: int = 20,
) -> Dict[str, Any]:
    jd_digest = _jd_hash(job_description)
    rows: List[Dict[str, Any]] = []
    docs = (
        _readiness_collection(uid)
        .where(filter=firestore.FieldFilter("target_role", "==", target_role.strip()))
        .where(filter=firestore.FieldFilter("jd_hash", "==", jd_digest))
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(max(1, min(limit, 60)))
        .stream()
    )
    for doc in docs:
        payload = doc.to_dict() or {}
        payload["id"] = doc.id
        payload["created_at"] = _serialize_ts(payload.get("created_at"))
        rows.append(payload)
    rows.reverse()

    points = [
        {
            "id": row.get("id"),
            "overall_score": int(row.get("overall_score") or 0),
            "computed_at": row.get("computed_at") or row.get("created_at"),
        }
        for row in rows
    ]
    deltas: List[Dict[str, Any]] = []
    prev: Optional[int] = None
    for point in points:
        score = int(point["overall_score"])
        delta = score - prev if prev is not None else 0
        deltas.append({**point, "delta_vs_prev": delta})
        prev = score

    return {
        "target_role": target_role.strip(),
        "jd_hash": jd_digest,
        "history": deltas,
    }
