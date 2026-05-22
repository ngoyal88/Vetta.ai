from datetime import datetime, timezone
from typing import Dict, Any, List
from utils.logger import get_logger
from services.interview.llm_engine import LLMEngine
from services.interview.transcript_service import extract_live_transcription

logger = get_logger("FeedbackService")

_TRANSCRIPT_TURN_LIMIT = 40

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

    async def generate_final_feedback(
        self,
        session_data: Dict
    ) -> Dict[str, Any]:
        """Generate comprehensive final feedback"""
        qa_summary = self._build_conversation_summary(session_data)

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

