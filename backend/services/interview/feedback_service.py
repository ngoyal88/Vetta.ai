from datetime import datetime, timezone
from typing import Dict, Any
from utils.logger import get_logger
from services.interview.llm_engine import LLMEngine

logger = get_logger("FeedbackService")

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
        from services.interview.interview_service import _extract_question_text

        qa_summary_parts = []
        for i, qa in enumerate(session_data.get('responses', [])):
            q_entry = qa.get('question', {})
            q_text = _extract_question_text(q_entry)
            a_text = qa.get('response', '')[:300]
            qa_summary_parts.append(f"Q{i+1}: {q_text}\nA{i+1}: {a_text}")
        qa_summary = "\n\n".join(qa_summary_parts)

        prompt = f"""Provide interview feedback:

Type: {session_data.get('interview_type')}
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

