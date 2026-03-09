from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from services.resume_parser import parse_resume_llm
from utils.auth import verify_firebase_token
from utils.logger import get_logger

router = APIRouter(prefix="/resume", tags=["Resume"])
logger = get_logger(__name__)

MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/plain; charset=utf-8",
}


def _allowed_file(filename: Optional[str], content_type: Optional[str]) -> bool:
    if not filename or not filename.strip():
        return False
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return False
    if content_type and content_type.strip():
        base_ct = content_type.split(";")[0].strip().lower()
        allowed_bases = {ct.split(";")[0].strip().lower() for ct in ALLOWED_CONTENT_TYPES}
        if base_ct not in allowed_bases:
            return False
    return True


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    uid: str = Depends(verify_firebase_token),
):
    if not _allowed_file(file.filename, file.content_type):
        raise HTTPException(
            400,
            "Unsupported file type. Allowed: PDF, DOCX, TXT.",
        )
    blob = await file.read(MAX_RESUME_SIZE_BYTES + 1)
    if len(blob) > MAX_RESUME_SIZE_BYTES:
        raise HTTPException(413, "File too large. Max size 10 MB.")
    if not blob:
        raise HTTPException(400, "empty file")
    try:
        parsed = await parse_resume_llm(blob, file.filename, uid)
        return {"profile": parsed.profile.dict(), "meta": parsed.meta}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        logger.exception("Resume parse failed")
        raise HTTPException(500, "Resume parsing failed. Please try again or use a different file.") from exc
