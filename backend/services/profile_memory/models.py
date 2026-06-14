from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

ClaimCategory = Literal["technical", "experience", "behavioral", "gap"]
DemonstrationStrength = Literal["strong", "adequate", "weak", "none"]
ClaimStatus = Literal["pending", "accepted", "rejected", "archived"]

STRENGTH_CATEGORIES = frozenset({"technical", "experience", "behavioral"})
GAP_CATEGORY = "gap"
EXTRACTION_VERSION = "vpm-1"
SCHEMA_VERSION = "vpm-1"


class RawClaim(BaseModel):
    claim_text: str = ""
    claim_category: ClaimCategory = "technical"
    demonstration_strength: DemonstrationStrength = "adequate"
    evidence_quote: str = ""
    confidence: float = 0.5


class GateResult(BaseModel):
    passed: bool
    reason: str = ""


class VerifiedClaimDraft(BaseModel):
    claim_text: str
    claim_category: ClaimCategory
    demonstration_strength: DemonstrationStrength
    evidence_quote: str
    confidence: float = 0.5


class BulkClaimActionItem(BaseModel):
    claim_id: str
    status: Literal["accepted", "rejected"]


class BulkClaimActionRequest(BaseModel):
    items: List[BulkClaimActionItem] = Field(default_factory=list)


class ClaimSummaryEntry(BaseModel):
    claim_id: Optional[str] = None
    claim_text: str
    evidence_quote: Optional[str] = None
    updated_at: Optional[str] = None
    source_session_id: Optional[str] = None
    demonstration_strength: Optional[str] = None


def claim_section(category: str) -> str:
    return "gap" if category == GAP_CATEGORY else "strength"


def summary_bucket_key(category: str) -> str:
    if category == GAP_CATEGORY:
        return "gaps"
    return category if category in STRENGTH_CATEGORIES else "technical"
