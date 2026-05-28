import json
from dataclasses import dataclass
from typing import Any, Callable, Dict, Generic, List, Optional, TypeVar

from models.interview import DifficultyLevel, InterviewType
from utils.logger import get_logger

logger = get_logger("PromptContracts")

T = TypeVar("T")


@dataclass
class PromptExecutionError:
    category: str
    message: str


@dataclass
class PromptContractResult(Generic[T]):
    template_id: str
    ok: bool
    value: T
    error: Optional[PromptExecutionError] = None


PromptContractInput = Dict[str, Any]


def extract_json_payload(raw: str, *, fallback: Any) -> Any:
    text = (raw or "").strip()
    if not text:
        return fallback
    candidate = text.strip("`").strip()
    if candidate.lower().startswith("json"):
        candidate = candidate[4:].strip()
    start = candidate.find("{")
    end = candidate.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(candidate[start:end])
        except Exception:
            pass
    start_arr = candidate.find("[")
    end_arr = candidate.rfind("]") + 1
    if start_arr >= 0 and end_arr > start_arr:
        try:
            return json.loads(candidate[start_arr:end_arr])
        except Exception:
            pass
    return fallback


def _to_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _coerce_enum(value: Any, allowed: List[str], default: str) -> str:
    v = str(value or "").strip().lower()
    normalized = {a.lower(): a for a in allowed}
    return normalized.get(v, default)


def build_follow_up_prompt(previous_qa: List[Dict[str, Any]], interview_type: InterviewType, llm_context: str) -> str:
    from services.interview.interview_service import _extract_question_text

    last_pairs = previous_qa[-4:]
    conversation_parts = []
    for qa in last_pairs:
        q_entry = qa.get("question", {})
        q_text = _extract_question_text(q_entry)
        a_text = qa.get("response", "")
        conversation_parts.append(f"Interviewer: {q_text}\nCandidate: {a_text[:500]}")
    conversation = "\n\n".join(conversation_parts) or "Interviewer: Let's begin.\nCandidate: (no response yet)"
    interview_type_str = interview_type.value if isinstance(interview_type, InterviewType) else str(interview_type)
    context_block = llm_context.strip() or f"INTERVIEW TYPE: {interview_type_str}\nCONVERSATION SO FAR:\n{conversation}"
    resume_mode_rule = ""
    if interview_type == InterviewType.RESUME_BASED:
        resume_mode_rule = (
            "\nResume deep-dive mode:\n"
            "- Every question must trace to a specific resume claim.\n"
            "- Probe metrics, constraints, ownership, and tradeoffs before moving on.\n"
            "- If an answer is vague, ask a tighter follow-up on that same claim."
        )

    return f"""SYSTEM PROMPT FOR INTERVIEWER LLM:

You are a senior software engineer conducting a real technical interview.
You are not a question dispenser. You are a person having a conversation.

Your personality:
- Curious and direct. You ask because you genuinely want to understand.
- Patient but not passive. If an answer is incomplete, you probe.
- You push harder when someone is doing well. You back off when they're lost.
- You occasionally say "hmm" or pause. You're thinking too.
- You never say "Great answer!" or "Excellent!" - it sounds fake.
  Instead: "Right.", "Okay, that makes sense.", "Interesting." or nothing.
- You reference things said earlier. You remember the whole conversation.
- When the candidate is coding, you acknowledge what you see on screen.

Your one rule:
Always react to what was JUST said before asking anything new.
Never jump to the next question without acknowledging the last answer.
Even a single word ("Right.") is enough. Never skip this.

THE CONTEXT BELOW IS YOUR REALITY. Trust it completely.
Adapt everything you say to what it tells you about this candidate right now.
{resume_mode_rule}

{context_block}

RECENT DIALOGUE:
{conversation}

Now respond as the interviewer. One focused thing at a time."""


async def execute_json_contract(
    *,
    template_id: str,
    engine: Any,
    prompt: str,
    temperature: float,
    fallback: T,
    normalizer: Callable[[Any], T],
    empty_fallback: str = "{}",
) -> PromptContractResult[T]:
    try:
        raw = await engine.generate_raw(prompt, temperature, empty_fallback=empty_fallback)
        parsed = extract_json_payload(raw, fallback=fallback)
        normalized = normalizer(parsed)
        return PromptContractResult(template_id=template_id, ok=True, value=normalized)
    except Exception as e:
        logger.warning("prompt_contract_error template_id=%s reason=%s", template_id, e)
        return PromptContractResult(
            template_id=template_id,
            ok=False,
            value=fallback,
            error=PromptExecutionError(category="provider_or_parse", message=str(e)),
        )


def normalize_question_payload(parsed: Any, *, fallback_question: str, difficulty: DifficultyLevel, q_type: str) -> Dict[str, Any]:
    obj = parsed if isinstance(parsed, dict) else {}
    return {
        "type": q_type,
        "question": str(obj.get("question") or fallback_question),
        "evaluation_criteria": str(obj.get("evaluation_criteria") or ""),
        "difficulty": difficulty.value,
    }


def normalize_answer_evaluation(parsed: Any) -> Dict[str, Any]:
    obj = parsed if isinstance(parsed, dict) else {}
    quality = _coerce_enum(
        obj.get("quality"),
        ["strong", "adequate", "weak", "confused", "no_answer"],
        "adequate",
    ).lower()
    confidence = _coerce_enum(obj.get("confidence_signal"), ["high", "medium", "low"], "medium").lower()
    action = _coerce_enum(
        obj.get("recommended_action"),
        ["probe", "challenge", "advance", "simplify", "hint"],
        "probe",
    ).lower()
    return {
        "quality": quality,
        "completeness": _clamp(_to_float(obj.get("completeness"), 0.5), 0.0, 1.0),
        "what_was_good": obj.get("what_was_good"),
        "what_was_missing": obj.get("what_was_missing"),
        "detected_misconception": obj.get("detected_misconception"),
        "confidence_signal": confidence,
        "recommended_action": action,
    }


def normalize_replay_highlights(parsed: Any, *, q_max: int, a_max: int, limit: int) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not isinstance(parsed, list):
        return out
    for item in parsed:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question") or "").strip()[:q_max]
        answer = str(item.get("answer") or "").strip()[:a_max]
        if not question or not answer:
            continue
        row: Dict[str, Any] = {"question": question, "answer": answer, "source": "llm"}
        c = item.get("confidence")
        if isinstance(c, (int, float)):
            row["confidence"] = round(_clamp(float(c), 0.0, 1.0), 3)
        out.append(row)
        if len(out) >= limit:
            break
    return out

