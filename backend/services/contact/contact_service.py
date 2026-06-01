"""Contact form: Firestore persistence + optional free outbound channels (Resend, SMTP, Discord)."""

from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from typing import Optional

import httpx
from firebase_admin import firestore as admin_firestore

from config import get_settings
from firebase_config import db
from models.contact import ContactSubmitRequest
from utils.logger import get_logger

_log = get_logger(__name__)
settings = get_settings()

INTENT_LABELS = {
    "candidate": "Candidate",
    "enterprise": "Enterprise / Coach",
    "press": "Press",
}


def _build_email_body(payload: ContactSubmitRequest) -> str:
    return "\n".join(
        [
            f"Intent: {INTENT_LABELS[payload.intent]}",
            f"Name: {payload.first_name} {payload.last_name}",
            f"Email: {payload.email}",
            "",
            "Message:",
            payload.user_message,
        ]
    )


def _build_subject(payload: ContactSubmitRequest) -> str:
    return f"[{INTENT_LABELS[payload.intent]}] Contact - Vetta.ai"


def _write_firestore(payload: ContactSubmitRequest, user_id: Optional[str]) -> None:
    doc = {
        "intent": payload.intent,
        "firstName": payload.first_name,
        "lastName": payload.last_name,
        "email": str(payload.email),
        "userMessage": payload.user_message,
        "sourcePage": payload.source_page,
        "createdAt": admin_firestore.SERVER_TIMESTAMP,
        "userId": user_id,
        "to": settings.contact_recipient_email,
        "message": {
            "subject": _build_subject(payload),
            "text": _build_email_body(payload),
        },
    }
    db.collection("contact_requests").add(doc)


async def _send_resend(payload: ContactSubmitRequest) -> bool:
    api_key = (settings.resend_api_key or "").strip()
    from_email = (settings.contact_from_email or "").strip()
    if not api_key or not from_email:
        return False

    body = {
        "from": from_email,
        "to": [settings.contact_recipient_email],
        "reply_to": str(payload.email),
        "subject": _build_subject(payload),
        "text": _build_email_body(payload),
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        if response.status_code >= 400:
            _log.warning("Resend API error %s: %s", response.status_code, response.text[:300])
            return False
        return True
    except Exception:
        _log.exception("Resend send failed")
        return False


def _send_smtp(payload: ContactSubmitRequest) -> bool:
    host = (settings.smtp_host or "").strip()
    user = (settings.smtp_user or "").strip()
    password = (settings.smtp_password or "").strip()
    if not host or not user or not password:
        return False

    msg = EmailMessage()
    msg["Subject"] = _build_subject(payload)
    msg["From"] = user
    msg["To"] = settings.contact_recipient_email
    msg["Reply-To"] = str(payload.email)
    msg.set_content(_build_email_body(payload))

    try:
        with smtplib.SMTP(host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        return True
    except Exception:
        _log.exception("SMTP send failed")
        return False


async def _notify_discord(payload: ContactSubmitRequest) -> bool:
    webhook = (settings.contact_discord_webhook_url or "").strip()
    if not webhook:
        return False

    content = (
        f"**New contact — {INTENT_LABELS[payload.intent]}**\n"
        f"**{payload.first_name} {payload.last_name}** ({payload.email})\n\n"
        f"{payload.user_message[:1800]}"
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook, json={"content": content})
        return response.status_code < 400
    except Exception:
        _log.exception("Discord webhook failed")
        return False


_FIRESTORE_WRITE_TIMEOUT_SEC = 20.0
_NOTIFICATION_TIMEOUT_SEC = 25.0


async def submit_contact(payload: ContactSubmitRequest, user_id: Optional[str]) -> tuple[bool, bool]:
    """Persist request and attempt optional notifications. Returns (email_sent, notified)."""
    try:
        await asyncio.wait_for(
            asyncio.to_thread(_write_firestore, payload, user_id),
            timeout=_FIRESTORE_WRITE_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError("Firestore write timed out") from exc

    email_sent = False
    notified = False

    async def _email_task() -> bool:
        if (settings.resend_api_key or "").strip():
            return await _send_resend(payload)
        if (settings.smtp_host or "").strip():
            return await asyncio.to_thread(_send_smtp, payload)
        return False

    try:
        results = await asyncio.wait_for(
            asyncio.gather(_email_task(), _notify_discord(payload), return_exceptions=True),
            timeout=_NOTIFICATION_TIMEOUT_SEC,
        )
        if isinstance(results[0], bool):
            email_sent = results[0]
        if isinstance(results[1], bool):
            notified = results[1]
    except asyncio.TimeoutError:
        _log.warning("Contact notifications timed out; submission was still stored")

    return email_sent, notified
