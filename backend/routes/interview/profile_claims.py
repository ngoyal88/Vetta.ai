from typing import Optional

from fastapi import Depends, HTTPException

from services.profile_memory.models import BulkClaimActionRequest
from services.profile_memory.profile_claims_repository import (
    get_profile_memory_summary,
    list_claims,
    resolve_session_access,
    update_claim_status,
)
from services.profile_memory.profile_claims_service import (
    bulk_update_claims,
    get_session_claims,
)
from utils.auth import verify_firebase_token
from utils.rate_limit import check_rate_limit

from . import router


@router.get("/profile-claims")
async def get_profile_claims(
    status: Optional[str] = None,
    category: Optional[str] = None,
    section: Optional[str] = None,
    limit: int = 40,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "profile_claims_list", limit=120, window_seconds=60)
    if status and status not in {"pending", "accepted", "rejected", "archived"}:
        raise HTTPException(400, "status must be pending, accepted, rejected, or archived")
    if section and section not in {"strength", "gap"}:
        raise HTTPException(400, "section must be strength or gap")
    if category and category not in {"technical", "experience", "behavioral", "gap"}:
        raise HTTPException(400, "invalid category")
    rows = await list_claims(
        uid,
        status=status,
        category=category,
        section=section,
        limit=limit,
    )
    return {"items": rows}


@router.get("/profile-claims/profile-memory")
async def get_profile_memory(
    limit: int = 120,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "profile_claims_list", limit=120, window_seconds=60)
    summary = await get_profile_memory_summary(uid)
    timeline = await list_claims(uid, status=None, limit=max(1, min(limit, 200)))
    return {"summary": summary, "timeline": timeline}


@router.get("/profile-claims/session/{session_id}")
async def get_profile_claims_for_session(
    session_id: str,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "profile_claims_list", limit=120, window_seconds=60)
    access = await resolve_session_access(session_id, uid)
    if access != "owned":
        raise HTTPException(404, "Session not found")
    return await get_session_claims(uid, session_id)


@router.post("/profile-claims/{claim_id}/accept")
async def accept_profile_claim(
    claim_id: str,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "profile_claims_update", limit=120, window_seconds=60)
    row, err = await update_claim_status(uid, claim_id, "accepted")
    if err == "not_found":
        raise HTTPException(404, "Claim not found")
    if err == "cap_exceeded":
        raise HTTPException(409, "Accepted claims cap reached (50). Archive or reject existing claims.")
    return {"item": row}


@router.post("/profile-claims/{claim_id}/reject")
async def reject_profile_claim(
    claim_id: str,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "profile_claims_update", limit=120, window_seconds=60)
    row, err = await update_claim_status(uid, claim_id, "rejected")
    if err == "not_found":
        raise HTTPException(404, "Claim not found")
    return {"item": row}


@router.post("/profile-claims/bulk")
async def bulk_update_profile_claims(
    request: BulkClaimActionRequest,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "profile_claims_bulk", limit=60, window_seconds=60)
    payload = await bulk_update_claims(
        uid,
        [{"claim_id": item.claim_id, "status": item.status} for item in request.items],
    )
    return payload
