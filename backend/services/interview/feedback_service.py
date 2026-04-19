from datetime import datetime, timezone
from typing import Dict, Any
from utils.logger import get_logger
from services.interview.llm_engine import LLMEngine

logger = get_logger("FeedbackService")

class FeedbackService:
    def __init__(self, engine:LLMEngine):
        self._engine = engine

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

        return {
            'feedback': feedback,
            'generated_at': datetime.now(timezone.utc).isoformat()
        }

