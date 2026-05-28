import json
from datetime import datetime, timezone
from typing import Dict, Any, List
from utils.logger import get_logger
from services.interview.llm_engine import LLMEngine
from services.interview.transcript_service import extract_live_transcription

logger = get_logger("FeedbackService")

_TRANSCRIPT_TURN_LIMIT = 40
_HIGHLIGHT_LIMIT = 3
_HIGHLIGHT_Q_MAX = 240
_HIGHLIGHT_A_MAX = 500

class FeedbackService:
    def __init__(self, engine:LLMEngine):
        self._engine = engine

    def _is_invalid_feedback_text(self, text: str) -> bool:
        t = (text or "").strip().lower()
        if not t:
            return True
        markers = (
            "error generating response",
            "rate limit",
            "rate_limit_exceeded",
            "too many requests",
            "apiconnectionerror",
            "failed to generate llm completion",
            "service not configured",
        )
        return any(m in t for m in markers)

    def _format_transcript_summary(self, lines: List[Dict[str, Any]], limit: int = _TRANSCRIPT_TURN_LIMIT) -> str:
        parts: List[str] = []
        for entry in lines[-limit:]:
            if not isinstance(entry, dict):
                continue
            speaker = str(entry.get("speaker") or entry.get("role") or "").lower()
            text = str(entry.get("text") or "").strip()[:500]
            if not text:
                continue
            label = "Candidate" if speaker == "candidate" else "Interviewer"
            parts.append(f"{label}: {text}")
        return "\n\n".join(parts)

    def _build_conversation_summary(self, session_data: Dict) -> str:
        from services.interview.interview_service import _extract_question_text

        responses = session_data.get("responses", []) or []
        if responses:
            qa_summary_parts = []
            for i, qa in enumerate(responses):
                q_entry = qa.get("question", {})
                q_text = _extract_question_text(q_entry)
                a_text = str(qa.get("response", "") or "")[:300]
                qa_summary_parts.append(f"Q{i + 1}: {q_text}\nA{i + 1}: {a_text}")
            return "\n\n".join(qa_summary_parts)

        live = session_data.get("live_transcription")
        if isinstance(live, list) and live:
            summary = self._format_transcript_summary(live)
            if summary:
                return summary

        extracted = extract_live_transcription(session_data)
        if extracted:
            return self._format_transcript_summary(extracted)

        return ""

    def _fallback_feedback(self, session_data: Dict) -> str:
        responses = session_data.get("responses", []) or []
        return (
            "OVERALL PERFORMANCE:\n"
            "Thanks for completing the interview. We hit a temporary AI service issue while finalizing detailed feedback.\n\n"
            f"Questions Answered: {len(responses)}\n"
            "A detailed report is currently unavailable, but your session progress has been saved.\n\n"
            "RECOMMENDATION: Needs Review\n"
            "Please re-run a short follow-up interview to generate complete scoring."
        )

    def _build_highlight_context(self, session_data: Dict) -> str:
        from services.interview.interview_service import _extract_question_text

        responses = session_data.get("responses", []) or []
        chunks: List[str] = []
        for idx, qa in enumerate(responses):
            if not isinstance(qa, dict):
                continue
            q_text = _extract_question_text(qa.get("question", {}))
            a_text = str(qa.get("response") or "").strip()
            if not q_text or not a_text:
                continue
            chunks.append(
                f"PAIR {idx + 1}\nInterviewer Question: {q_text[:400]}\nCandidate Answer: {a_text[:700]}"
            )

        if chunks:
            return "\n\n".join(chunks[:12])

        live = session_data.get("live_transcription")
        if isinstance(live, list) and live:
            return self._format_transcript_summary(live, limit=60)

        extracted = extract_live_transcription(session_data)
        if extracted:
            return self._format_transcript_summary(extracted, limit=60)

        return ""

    def _sanitize_replay_highlights(self, raw: Any) -> List[Dict[str, Any]]:
        highlights: List[Dict[str, Any]] = []
        if not isinstance(raw, list):
            return highlights

        for item in raw:
            if not isinstance(item, dict):
                continue
            question = str(item.get("question") or "").strip()[:_HIGHLIGHT_Q_MAX]
            answer = str(item.get("answer") or "").strip()[:_HIGHLIGHT_A_MAX]
            if not question or not answer:
                continue

            sanitized: Dict[str, Any] = {
                "question": question,
                "answer": answer,
                "source": "llm",
            }

            confidence = item.get("confidence")
            if isinstance(confidence, (int, float)):
                c = max(0.0, min(float(confidence), 1.0))
                sanitized["confidence"] = round(c, 3)

            highlights.append(sanitized)
            if len(highlights) >= _HIGHLIGHT_LIMIT:
                break

        return highlights

    async def generate_replay_highlights(self, session_data: Dict) -> List[Dict[str, Any]]:
        context = self._build_highlight_context(session_data)
        if not context.strip():
            return []

        prompt = f"""Extract exactly up to {_HIGHLIGHT_LIMIT} replay highlights from this interview.
Return ONLY a JSON array. No markdown. No prose.

Output JSON item schema:
{{
  "question": "string",
  "answer": "string",
  "confidence": 0.0
}}

Rules:
- Each item must be one interviewer question and the candidate's direct answer.
- Keep wording faithful and concise.
- Omit weak/empty exchanges.
- Maximum {_HIGHLIGHT_LIMIT} items.

Conversation context:
{context}
"""
        try:
            raw = await self._engine.generate_raw(prompt, 0.0, empty_fallback="[]")
            parsed = json.loads(raw)
            return self._sanitize_replay_highlights(parsed)
        except Exception:
            return []

    def _insufficient_data_feedback(self, session_data: Dict, reason: str) -> str:
        role = session_data.get("target_role") or session_data.get("custom_role") or "this role"
        duration = session_data.get("duration", 0)
        reason_copy = {
            "silence_timeout": (
                "The session ended because we did not receive a spoken response for about 3 minutes."
            ),
            "tab_away_timeout": (
                "The session ended because you were away from the interview tab for more than 10 minutes."
            ),
            "candidate_disconnected": (
                "The session ended because the connection was lost for an extended period."
            ),
        }.get(reason, "The session ended before enough conversation was captured.")
        return (
            "OVERALL PERFORMANCE:\n"
            f"{reason_copy} "
            "That can happen if the microphone was muted, the tab was in the background, or you needed more time.\n\n"
            f"Duration: {duration} minutes\n"
            "Questions Answered: 0\n\n"
            "TECHNICAL SKILLS: N/A\n"
            "Not enough spoken answers to assess technical depth.\n\n"
            "COMMUNICATION: N/A\n"
            "Not enough spoken answers to assess communication.\n\n"
            "KEY STRENGTHS:\n"
            "- Session started successfully\n\n"
            "AREAS FOR IMPROVEMENT:\n"
            "- Check microphone permissions before starting\n"
            "- Stay on the interview tab while the AI is listening\n"
            f"- Try a shorter retry focused on {role}\n\n"
            "RECOMMENDATION: Retry\n"
            "Start a fresh session when you are ready to speak."
        )

    async def generate_final_feedback(
        self,
        session_data: Dict
    ) -> Dict[str, Any]:
        """Generate comprehensive final feedback"""
        qa_summary = self._build_conversation_summary(session_data)
        completion_reason = str(session_data.get("completion_reason") or "").lower()
        thin_session_reasons = {"silence_timeout", "tab_away_timeout", "candidate_disconnected"}
        if completion_reason in thin_session_reasons and not qa_summary.strip():
            text = self._insufficient_data_feedback(session_data, completion_reason)
            return {
                "feedback": text,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "completion_reason": completion_reason,
            }

        prompt = f"""Provide interview feedback:

Type: {session_data.get('interview_type')}
Target Company: {session_data.get('target_company') or ''}
Target Role: {session_data.get('target_role') or session_data.get('custom_role') or ''}
Interview Focus: {session_data.get('interview_focus') or ''}
JD Fit Context: {session_data.get('jd_fit_context') or {}}
Duration: {session_data.get('duration', 0)} minutes
Questions Answered: {len(session_data.get('responses', []))}

Conversation:
{qa_summary}

Provide structured feedback:

OVERALL PERFORMANCE:
[2-3 sentence summary]

TECHNICAL SKILLS: X/10
[Brief assessment]

COMMUNICATION: X/10
[Brief assessment]

KEY STRENGTHS:
- [strength 1]
- [strength 2]
- [strength 3]

AREAS FOR IMPROVEMENT:
- [area 1 with specific action]
- [area 2 with specific action]
- [area 3 with specific action]

ROLE READINESS:
[If this was role_targeted, give role readiness for the target JD/company, top gaps, and the next focused practice plan. Otherwise keep this brief.]

RECOMMENDATION: [Hire / Strong Maybe / Needs Improvement]
[One sentence rationale]"""

        feedback = await self._engine.generate(prompt, 0.3)
        if self._is_invalid_feedback_text(feedback):
            logger.warning("Feedback generation returned invalid/provider-error text; using safe fallback")
            feedback = self._fallback_feedback(session_data)

        return {
            'feedback': feedback,
            'generated_at': datetime.now(timezone.utc).isoformat()
        }

