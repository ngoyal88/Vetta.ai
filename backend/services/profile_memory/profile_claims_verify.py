from __future__ import annotations



from dataclasses import dataclass

from typing import Any, Dict, List, Tuple



from config import get_settings

from services.interview.prompt_contracts import execute_json_contract

from services.profile_memory.demonstration_scorer import quote_grounded_in_transcript

from services.profile_memory.models import RawClaim, VerifiedClaimDraft

from services.profile_memory.umbrella_terms import normalize_text

from utils.logger import get_logger



logger = get_logger("ProfileClaimsVerify")





@dataclass

class VerifyBatchResult:

    approved: List[VerifiedClaimDraft]

    verify_ok: bool

    degraded: bool = False

    chunks_failed: int = 0

    error_code: str | None = None





def _parse_verify_payload(parsed: Any) -> List[Dict[str, Any]]:

    if isinstance(parsed, dict) and isinstance(parsed.get("results"), list):

        return [row for row in parsed["results"] if isinstance(row, dict)]

    if isinstance(parsed, list):

        return [row for row in parsed if isinstance(row, dict)]

    return []





def _chunk_size() -> int:

    return max(1, int(getattr(get_settings(), "vpm_verify_chunk_size", 5)))





def _max_retries() -> int:

    return max(0, int(getattr(get_settings(), "vpm_verify_max_retries", 1)))





def _gate_fallback_enabled() -> bool:

    return bool(getattr(get_settings(), "vpm_verify_gate_fallback", True))





def build_verify_prompt(*, claims: List[RawClaim], transcript_context: str) -> str:

    claim_lines = []

    for idx, claim in enumerate(claims):

        claim_lines.append(

            f'{idx}: category={claim.claim_category} strength={claim.demonstration_strength} '

            f'claim="{claim.claim_text}" quote="{claim.evidence_quote}"'

        )

    claims_blob = "\n".join(claim_lines) or "(none)"

    return f"""Verify candidate profile claims against interview evidence.

Return ONLY JSON:

{{

  "results": [

    {{

      "index": 0,

      "approved": true,

      "grounding_ok": true,

      "reason": "string",

      "demonstration_strength": "strong|adequate|weak|none"

    }}

  ]

}}

Rules:

- Approve only if evidence_quote shows the candidate EXPLAINED with specifics (not just mentioned a topic).

- grounding_ok must be true only if the quote appears in transcript context.

- Reject umbrella labels without depth (system design, leadership, communication).

- For gap category, approve weak gaps when quote shows inability to explain.

- Adjust demonstration_strength if needed.

Transcript context:

{transcript_context[:4000]}

Claims:

{claims_blob}

"""





def _gate_fallback_drafts(claims: List[RawClaim]) -> List[VerifiedClaimDraft]:

    return [

        VerifiedClaimDraft(

            claim_text=claim.claim_text,

            claim_category=claim.claim_category,

            demonstration_strength=claim.demonstration_strength,

            evidence_quote=claim.evidence_quote,

            confidence=claim.confidence,

        )

        for claim in claims

    ]





def _process_chunk_results(

    *,

    claims: List[RawClaim],

    results: List[Dict[str, Any]],

    contract_ok: bool,

    transcript_normalized: str,

) -> Tuple[List[VerifiedClaimDraft], bool, bool]:

    if not contract_ok:

        if _gate_fallback_enabled():

            logger.warning("vpm_verifier_degraded chunk_size=%s", len(claims))

            return _gate_fallback_drafts(claims), True, True

        logger.warning("vpm_verifier_failed chunk_size=%s", len(claims))

        return [], False, False



    approved: List[VerifiedClaimDraft] = []

    index_map: Dict[int, Dict[str, Any]] = {}

    for row in results:

        try:

            index_map[int(row.get("index"))] = row

        except (TypeError, ValueError):

            continue

    for idx, claim in enumerate(claims):

        row = index_map.get(idx, {})

        approved_flag = bool(row.get("approved"))

        grounding_ok = bool(row.get("grounding_ok", True))

        if not grounding_ok:

            grounding_ok = quote_grounded_in_transcript(claim.evidence_quote, transcript_normalized)

        if not approved_flag:

            logger.info(

                "vpm_verifier_reject claim=%s reason=%s",

                claim.claim_text[:80],

                str(row.get("reason") or "rejected"),

            )

            continue

        if not grounding_ok:

            logger.info("vpm_verifier_reject claim=%s reason=grounding_failed", claim.claim_text[:80])

            continue

        strength = str(row.get("demonstration_strength") or claim.demonstration_strength).lower()

        if strength not in {"strong", "adequate", "weak", "none"}:

            strength = claim.demonstration_strength

        if claim.claim_category == "gap":

            if strength not in {"weak", "adequate", "strong"}:

                continue

        elif strength not in {"strong", "adequate"}:

            continue

        approved.append(

            VerifiedClaimDraft(

                claim_text=claim.claim_text,

                claim_category=claim.claim_category,

                demonstration_strength=strength,  # type: ignore[arg-type]

                evidence_quote=claim.evidence_quote,

                confidence=claim.confidence,

            )

        )

    return approved, True, False





async def _verify_chunk(

    *,

    engine: Any,

    claims: List[RawClaim],

    transcript_context: str,

    transcript_normalized: str,

) -> Tuple[List[VerifiedClaimDraft], bool, bool]:

    prompt = build_verify_prompt(claims=claims, transcript_context=transcript_context)

    retries = _max_retries()

    last_ok = False

    results: List[Dict[str, Any]] = []

    for attempt in range(retries + 1):

        contract = await execute_json_contract(

            template_id="profile_claims_verify_v1",

            engine=engine,

            prompt=prompt,

            temperature=0.1,

            fallback={"results": []},

            normalizer=_parse_verify_payload,

            empty_fallback="{}",

        )

        results = contract.value if isinstance(contract.value, list) else _parse_verify_payload(contract.value)

        last_ok = contract.ok

        if contract.ok:

            break

        if attempt < retries:

            logger.info("vpm_verifier_retry attempt=%s", attempt + 1)

    return _process_chunk_results(

        claims=claims,

        results=results,

        contract_ok=last_ok,

        transcript_normalized=transcript_normalized,

    )





async def verify_claims_batch(

    *,

    engine: Any,

    claims: List[RawClaim],

    transcript_context: str,

    transcript_normalized: str = "",

) -> VerifyBatchResult:

    if not claims:

        return VerifyBatchResult(approved=[], verify_ok=True)

    norm = transcript_normalized or normalize_text(transcript_context)

    chunk_sz = _chunk_size()

    all_approved: List[VerifiedClaimDraft] = []

    degraded = False

    chunks_failed = 0

    for start in range(0, len(claims), chunk_sz):

        chunk = claims[start : start + chunk_sz]

        approved, ok, chunk_degraded = await _verify_chunk(

            engine=engine,

            claims=chunk,

            transcript_context=transcript_context,

            transcript_normalized=norm,

        )

        if chunk_degraded:

            degraded = True

            chunks_failed += 1

        if not ok:

            return VerifyBatchResult(

                approved=[],

                verify_ok=False,

                degraded=degraded,

                chunks_failed=chunks_failed,

                error_code="verify_failed",

            )

        all_approved.extend(approved)

    return VerifyBatchResult(

        approved=all_approved,

        verify_ok=True,

        degraded=degraded,

        chunks_failed=chunks_failed,

    )


