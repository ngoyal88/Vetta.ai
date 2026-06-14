from __future__ import annotations

from typing import Dict, Set

from services.profile_memory.demonstration_scorer import score_demonstration
from services.profile_memory.models import GateResult, RawClaim
from services.profile_memory.umbrella_terms import normalize_text


def apply_gate(
    claim: RawClaim,
    *,
    resume_known: Dict[str, Set[str]],
    rejected_keys: Set[str],
    accepted_keys: Set[str],
    transcript_normalized: str = "",
) -> GateResult:
    normalized_key = normalize_text(claim.claim_text or "")
    if normalized_key in rejected_keys:
        return GateResult(passed=False, reason="g6_rejected_duplicate")
    if normalized_key in accepted_keys:
        return GateResult(passed=False, reason="g5_already_accepted")
    demo = score_demonstration(
        claim.claim_text,
        claim.evidence_quote,
        claim_category=claim.claim_category,
        demonstration_strength=claim.demonstration_strength,
        transcript_normalized=transcript_normalized,
        resume_known=resume_known,
    )
    if demo.passed:
        return GateResult(passed=True, reason=demo.reason)
    return GateResult(passed=False, reason=demo.reason)
