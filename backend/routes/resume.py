from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from services.resume_parser import parse_resume
from utils.auth import verify_firebase_token

router = APIRouter(prefix="/resume", tags=["Resume"])

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    uid: str = Depends(verify_firebase_token),
):
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "empty file")
    try:
        result = parse_resume(blob, file.filename)

        # `parse_resume` returns an Affinda-style shape: {"data": {...}, "meta": {...}}
        # Keep the public API consistent with README + frontend expectations.
        data = result.get("data") if isinstance(result, dict) else None
        meta = result.get("meta") if isinstance(result, dict) else None
        if not isinstance(data, dict):
            raise ValueError("parser returned invalid data shape")
        if not isinstance(meta, dict):
            meta = {}

        # Attach uid for traceability without storing PII in the parsed content.
        meta = {**meta, "uid": uid}
        return {"data": data, "meta": meta}
    except Exception as exc:
        raise HTTPException(500, f"parser-error: {exc}") from exc
