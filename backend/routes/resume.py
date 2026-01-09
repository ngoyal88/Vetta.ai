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
        # attach uid for traceability without storing PII
        return {"message": "parsed", "uid": uid, "data": result}
    except Exception as exc:
        raise HTTPException(500, f"parser-error: {exc}") from exc
