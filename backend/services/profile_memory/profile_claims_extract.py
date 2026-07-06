from __future__ import annotations

from typing import Any, Dict, List

from services.interview.prompt_contracts import execute_json_contract
from services.profile_memory.models import RawClaim
from services.resume.skills_normalizer import flatten_skills_from_profile


def _normalize_strength(value: Any) -> str:
    raw = str(value or "adequate").strip().lower()
    if raw in {"strong", "adequate", "weak", "none"}:
        return raw
    return "adequate"


def _normalize_category(value: Any) -> str:
    raw = str(value or "technical").strip().lower()
    if raw in {"technical", "experience", "behavioral", "gap"}:
        return raw
    return "technical"


def parse_extract_payload(parsed: Any) -> List[RawClaim]:
    out: List[RawClaim] = []
    if not isinstance(parsed, dict):
        return out
    rows = parsed.get("claims")
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        claim_text = str(row.get("claim_text") or "").strip()
        evidence_quote = str(row.get("evidence_quote") or "").strip()
        if not claim_text or not evidence_quote:
            continue
        try:
            confidence = float(row.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))
        out.append(
            RawClaim(
                claim_text=claim_text[:280],
                claim_category=_normalize_category(row.get("claim_category")),  # type: ignore[arg-type]
                demonstration_strength=_normalize_strength(row.get("demonstration_strength")),  # type: ignore[arg-type]
                evidence_quote=evidence_quote[:500],
                confidence=confidence,
            )
        )
    return out


def _compact_resume_summary(resume_data: Dict[str, Any]) -> str:
    if not isinstance(resume_data, dict):
        return "none"
    skills: List[str] = flatten_skills_from_profile(resume_data)[:15]
    projects: List[str] = []
    for project in (resume_data.get("projects") or [])[:5]:
        if isinstance(project, dict):
            name = str(project.get("name") or "").strip()
            if name:
                projects.append(name)
        elif isinstance(project, str) and project.strip():
            projects.append(project.strip())
    years = resume_data.get("years_experience") or resume_data.get("yearsExperience")
    summary = str(resume_data.get("summary") or "")[:300]
    return (
        f"years: {years or 'n/a'}\n"
        f"skills: {', '.join(skills[:15]) or 'n/a'}\n"
        f"projects: {', '.join(projects) or 'n/a'}\n"
        f"summary: {summary or 'n/a'}"
    )


def _cap_blob(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 20] + "\n...[truncated]"


def build_extract_prompt(
    *,
    resume_data: Dict[str, Any],
    transcript_blob: str,
    qa_blob: str,
    code_blob: str,
    jd_fit_context: Dict[str, Any],
    target_role: str = "",
) -> str:
    gaps = jd_fit_context.get("candidate_gaps") if isinstance(jd_fit_context, dict) else []
    gap_hint = ", ".join([str(g) for g in gaps[:6]]) if isinstance(gaps, list) else ""
    resume_summary = _compact_resume_summary(resume_data)
    transcript_blob = _cap_blob(transcript_blob, 2400)
    qa_blob = _cap_blob(qa_blob, 2400)
    code_blob = _cap_blob(code_blob, 800)
    return f"""Extract candidate profile claims from INTERVIEW EVIDENCE only.
Return ONLY valid JSON:
{{
  "claims": [
    {{
      "claim_text": "string",
      "claim_category": "technical|experience|behavioral|gap",
      "demonstration_strength": "strong|adequate|weak|none",
      "evidence_quote": "string",
      "confidence": 0.0
    }}
  ]
}}
Rules:
- Use ONLY candidate speech as evidence (not interviewer questions).
- Do NOT treat topic mentions as skills (e.g. saying "system design" once is NOT a technical claim).
- claim_text must be atomic and specific (prefer "API rate limiting at 2k RPS" over "system design").
- evidence_quote must be substantive candidate words (min ~40 chars) copied from transcript.
- Emit "gap" when candidate failed to explain something important.
- Max 8 claims.
Target role: {target_role or "n/a"}
JD gap hints: {gap_hint or "none"}
Resume summary:
{resume_summary}
Interview transcript:
{transcript_blob}
Interview Q/A:
{qa_blob}
Code behavior:
{code_blob}
"""


async def extract_claims(
    *,
    engine: Any,
    resume_data: Dict[str, Any],
    transcript_blob: str,
    qa_blob: str,
    code_blob: str,
    jd_fit_context: Dict[str, Any],
    max_raw: int,
    target_role: str = "",
) -> tuple[List[RawClaim], bool]:
    prompt = build_extract_prompt(
        resume_data=resume_data,
        transcript_blob=transcript_blob,
        qa_blob=qa_blob,
        code_blob=code_blob,
        jd_fit_context=jd_fit_context,
        target_role=target_role,
    )
    contract = await execute_json_contract(
        template_id="profile_claims_extract_v1",
        engine=engine,
        prompt=prompt,
        temperature=0.2,
        fallback={"claims": []},
        normalizer=parse_extract_payload,
        empty_fallback="{}",
    )
    rows = contract.value if isinstance(contract.value, list) else parse_extract_payload(contract.value)
    return rows[:max_raw], contract.ok
