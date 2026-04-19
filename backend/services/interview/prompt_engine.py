import re
from typing import Any, AsyncGenerator, Optional, List, Dict

from utils.logger import get_logger
from models.interview import InterviewType
from services.interview.llm_engine import LLMEngine

logger = get_logger("PromptEngine")

class PromptEngine:
    def __init__(self, engine:LLMEngine):
        self._engine = engine

    def _build_interviewer_prompt(self, previous_qa: List[Dict], interview_type: InterviewType, llm_context: str = "",) -> str:
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

{context_block}

RECENT DIALOGUE:
{conversation}

Now respond as the interviewer. One focused thing at a time."""

    def _clamp_greeting_text(self, raw: str, max_chars: int = 420) -> str:
        """Keep TTS short: first 1–2 sentences, bounded length (avoids huge MP3 / slow playback)."""
        text = (raw or "").strip()
        if not text:
            return ""
        sentences = re.split(r"(?<=[.!?])\s+", text)
        out = " ".join(sentences[:2]).strip()
        if not out:
            out = text
        if len(out) > max_chars:
            out = text[:max_chars].rsplit(" ", 1)[0].strip() + "."
        return out

    async def generate_greeting(self, candidate_name: str, role: str) -> str:
        """Generates a warm, professional intro"""
        prompt = f"""You are a senior technical interviewer for a {role} position. 
The candidate's name is {candidate_name}.

Generate a short, professional 2-sentence greeting to start the interview. 
Keep it friendly and encouraging. Do NOT ask a technical question yet.

Example: "Hello {candidate_name}! Welcome to this {role} interview. I'm excited to learn more about your experience today."
"""
        raw = await self._engine.generate(prompt, 0.55)
        clamped = self._clamp_greeting_text(raw)
        return clamped if clamped else self._clamp_greeting_text(
            f"Hello {candidate_name}. Welcome to this {role} interview. Let's begin."
        )


    def _build_context(self, interview_type: InterviewType, resume_data: Dict = None, custom_role: str = None, years_experience: Optional[int] = None) -> str:
        """Build context from resume data. Supports legacy (list of {name}) and LLM profile (skills dict, projects list of dicts)."""
        context = ""

        if resume_data:
            raw_skills = resume_data.get("skills")
            raw_projects = resume_data.get("projects") or []

            # Skills: either list of {name: "..."} (legacy) or dict of lists (LLM profile)
            if isinstance(raw_skills, dict):
                skills = []
                for key in ("languages", "frameworks", "databases", "cloud", "tools", "ml_ai", "other"):
                    part = raw_skills.get(key) or []
                    skills.extend(s for s in part if isinstance(s, str) and s.strip())
            elif isinstance(raw_skills, list):
                skills = []
                for s in raw_skills:
                    if isinstance(s, str) and s.strip():
                        skills.append(s)
                    elif isinstance(s, dict):
                        skills.append((s.get("name") or "").strip())
                skills = [s for s in skills if s]
            else:
                skills = []

            # Projects: list of dicts with "name" or list of strings
            projects = []
            for p in raw_projects:
                if isinstance(p, dict):
                    name = (p.get("name") or "").strip()
                    if name:
                        projects.append(name)
                elif isinstance(p, str) and p.strip():
                    projects.append(p.strip())

            if skills:
                context += f"\nCandidate Skills: {', '.join(skills[:10])}"
            if projects:
                context += f"\nProjects: {', '.join(projects[:3])}"

        if custom_role:
            context += f"\nTarget Role: {custom_role}"

        if years_experience is not None:
            context += f"\nYears of Experience: {years_experience}"

        return context


    async def generate_follow_up(self, previous_qa: List[Dict], interview_type: InterviewType, llm_context: str = "",) -> str:
        """Generate the interviewer's next spoken response."""
        prompt = self._build_interviewer_prompt(previous_qa, interview_type, llm_context=llm_context)
        question = await self._engine.generate(prompt, 0.8)
        return question.strip()

    async def generate_follow_up_stream(self, previous_qa: List[Dict], interview_type: InterviewType, llm_context: str = "",) -> AsyncGenerator[str, None]:
        """Stream the interviewer's next spoken response token-by-token."""
        prompt = self._build_interviewer_prompt(previous_qa, interview_type, llm_context=llm_context)

        async for chunk in self._engine.generate_stream(prompt, 0.8):
            yield chunk



