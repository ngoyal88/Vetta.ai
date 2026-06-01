from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from services.interview.readiness_service import compute_readiness, get_readiness_history
from utils.auth import verify_firebase_token
from utils.rate_limit import check_rate_limit

from . import router


class ReadinessComputeRequest(BaseModel):
    target_role: str = Field(..., min_length=2, max_length=160)
    job_description: Optional[str] = Field(default="", max_length=8000)
    resume_id: Optional[str] = None
    version_id: Optional[str] = None


@router.post("/readiness/compute")
async def readiness_compute(
    request: ReadinessComputeRequest,
    uid: str = Depends(verify_firebase_token),
) -> Dict[str, Any]:
    await check_rate_limit(uid, "readiness_compute", limit=30, window_seconds=60)
    target_role = (request.target_role or "").strip()
    if not target_role:
        raise HTTPException(400, "target_role is required")
    return await compute_readiness(
        uid=uid,
        target_role=target_role,
        job_description=(request.job_description or "").strip(),
        resume_id=request.resume_id,
        version_id=request.version_id,
    )


@router.get("/readiness/history")
async def readiness_history(
    target_role: str,
    job_description: str = "",
    limit: int = 20,
    uid: str = Depends(verify_firebase_token),
) -> Dict[str, Any]:
    await check_rate_limit(uid, "readiness_history", limit=120, window_seconds=60)
    role = (target_role or "").strip()
    if not role:
        raise HTTPException(400, "target_role is required")
    return await get_readiness_history(
        uid=uid,
        target_role=role,
        job_description=(job_description or "").strip(),
        limit=limit,
    )
