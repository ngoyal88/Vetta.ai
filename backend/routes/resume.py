from fastapi import APIRouter, UploadFile, File, HTTPException
from services.resume_parser import parse_resume

router = APIRouter(prefix="/resume", tags=["Resume"])

@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "empty file")
    try:
        return parse_resume(blob, file.filename)
    except Exception as exc:
        raise HTTPException(500, f"parser-error: {exc}") from exc
