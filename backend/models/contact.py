from typing import Literal

from pydantic import BaseModel, EmailStr, Field


ContactIntent = Literal["candidate", "enterprise", "press"]


class ContactSubmitRequest(BaseModel):
    intent: ContactIntent
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    user_message: str = Field(min_length=12, max_length=5000)
    source_page: str = Field(default="contact", max_length=120)


class ContactSubmitResponse(BaseModel):
    ok: bool = True
    stored: bool = True
    email_sent: bool = False
    notified: bool = False
