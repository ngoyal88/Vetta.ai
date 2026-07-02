"""Application Fit (JD Fit) API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from services.jd_fit.jd_fit_models import ComputeRequest, ComputeResponse, HistoryResponse
from services.jd_fit.jd_fit_service import JDFitService
from utils.auth import verify_firebase_token
from utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/jd-fit", tags=["ApplicationFit"])
_service = JDFitService()


@router.post("/compute", response_model=ComputeResponse)
async def jd_fit_compute(
    request: ComputeRequest,
    uid: str = Depends(verify_firebase_token),
) -> ComputeResponse:
    await check_rate_limit(uid, "jd_fit_compute", limit=30, window_seconds=3600)
    return await _service.compute_fit(
        uid=uid,
        target_role=request.target_role,
        target_company=request.target_company,
        job_description=request.job_description,
        resume_id=request.resume_id,
        version_id=request.version_id,
        first_seen=request.first_seen,
    )


@router.get("/history", response_model=HistoryResponse)
async def jd_fit_history(
    target_role: str,
    job_description: str = "",
    limit: int = 20,
    uid: str = Depends(verify_firebase_token),
) -> HistoryResponse:
    await check_rate_limit(uid, "jd_fit_history", limit=120, window_seconds=60)
    return await _service.get_history(
        uid=uid,
        target_role=target_role,
        job_description=job_description,
        limit=limit,
    )


@router.get("/snapshots/{snapshot_id}", response_model=ComputeResponse)
async def jd_fit_get_snapshot(
    snapshot_id: str,
    uid: str = Depends(verify_firebase_token),
) -> ComputeResponse:
    await check_rate_limit(uid, "jd_fit_history", limit=120, window_seconds=60)
    return await _service.get_snapshot_response(uid, snapshot_id)
