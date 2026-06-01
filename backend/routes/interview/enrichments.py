from typing import List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from services.interview.candidate_enrichment_service import (
    get_enrichment_summary,
    list_enrichments,
    update_enrichment_status,
)
from utils.auth import verify_firebase_token
from utils.rate_limit import check_rate_limit

from . import router


class BulkActionItem(BaseModel):
    enrichment_id: str
    status: str


class BulkActionRequest(BaseModel):
    items: List[BulkActionItem] = Field(default_factory=list)


@router.get("/enrichments")
async def get_candidate_enrichments(
    status: Optional[str] = None,
    limit: int = 40,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "enrichments_list", limit=120, window_seconds=60)
    if status and status not in {"pending", "accepted", "rejected"}:
        raise HTTPException(400, "status must be pending, accepted, or rejected")
    rows = await list_enrichments(uid, status=status, limit=limit)
    return {"items": rows}


@router.get("/enrichments/profile-memory")
async def get_profile_memory(
    limit: int = 60,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "enrichments_list", limit=120, window_seconds=60)
    summary = await get_enrichment_summary(uid)
    timeline = await list_enrichments(uid, status=None, limit=max(1, min(limit, 200)))
    return {"summary": summary, "timeline": timeline}


@router.post("/enrichments/{enrichment_id}/accept")
async def accept_enrichment(
    enrichment_id: str,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "enrichments_update", limit=120, window_seconds=60)
    row = await update_enrichment_status(uid, enrichment_id, "accepted")
    if not row:
        raise HTTPException(404, "Enrichment not found")
    return {"item": row}


@router.post("/enrichments/{enrichment_id}/reject")
async def reject_enrichment(
    enrichment_id: str,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "enrichments_update", limit=120, window_seconds=60)
    row = await update_enrichment_status(uid, enrichment_id, "rejected")
    if not row:
        raise HTTPException(404, "Enrichment not found")
    return {"item": row}


@router.post("/enrichments/bulk")
async def bulk_update_enrichments(
    request: BulkActionRequest,
    uid: str = Depends(verify_firebase_token),
):
    await check_rate_limit(uid, "enrichments_bulk", limit=60, window_seconds=60)
    out = []
    for item in request.items[:100]:
        if item.status not in {"accepted", "rejected"}:
            continue
        row = await update_enrichment_status(uid, item.enrichment_id, item.status)
        if row:
            out.append(row)
    return {"items": out, "count": len(out)}
