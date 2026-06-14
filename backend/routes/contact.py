from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status

from config import get_settings
from models.contact import ContactSubmitRequest, ContactSubmitResponse
from services.contact.contact_service import submit_contact
from utils.auth import verify_firebase_token
from utils.logger import get_logger
from utils.rate_limit import check_rate_limit_ip

router = APIRouter(prefix="/contact", tags=["Contact"])
log = get_logger(__name__)
settings = get_settings()


async def _optional_uid(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        return None
    try:
        return await verify_firebase_token(request)
    except HTTPException:
        return None


@router.post("", response_model=ContactSubmitResponse)
async def submit_contact_form(request: Request, body: ContactSubmitRequest) -> ContactSubmitResponse:
    """Public contact form — no Firebase email extensions required."""
    await check_rate_limit_ip(
        request,
        "contact",
        limit=settings.contact_rate_limit,
        window_seconds=settings.contact_rate_window_seconds,
    )

    user_id = await _optional_uid(request)

    try:
        email_sent, notified = await submit_contact(body, user_id)
    except Exception as exc:
        log.error("Contact submit failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not save your message. Try hello@vetta.ai directly.",
        ) from exc

    return ContactSubmitResponse(
        ok=True,
        stored=True,
        email_sent=email_sent,
        notified=notified,
    )
