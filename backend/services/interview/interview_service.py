"""Interview orchestration facade: delegates to LLMEngine, PromptEngine, QuestionService, etc."""
import json
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional, Union

from config import get_settings
from models.interview import DifficultyLevel, InterviewType
from services.interview.answer_evaluator import AnswerEvaluator
from services.interview.answer_processor import AnswerProcessor
from services.interview.feedback_service import FeedbackService
from services.interview.jd_context_service import JDContextService
from services.interview.llm_engine import LLMEngine
from services.interview.prompt_engine import PromptEngine
from services.interview.question_service import QuestionService
from services.interview.resume_context_service import ResumeContextService
from utils.logger import get_logger

logger = get_logger("InterviewService")


def _parse_interview_type(val: Optional[str]) -> InterviewType:
    """Parse InterviewType from string, case-insensitive. Defaults to DSA on failure."""
    if not val:
        return InterviewType.DSA
    try:
        return InterviewType(val)
    except Exception:
        pass
    v = val.strip().lower()
    for it in InterviewType:
        try:
            if it.name.lower() == v or str(it.value).lower() == v:
                return it
        except Exception:
            continue
    logger.warning("Unknown InterviewType %r, defaulting to DSA", val)
    return InterviewType.DSA


def _normalize_question_entry(q: Union[str, Dict], default_type: str = "behavioral") -> Dict:
    """Normalise a questions[] entry to the canonical shape."""
    if isinstance(q, dict):
        if "question" in q or "title" in q or "description" in q:
            out = q.copy()
            if "type" not in out:
                out["type"] = default_type
            return out
        return {
            "question": q,
            "type": q.get("type", default_type),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    return {
        "question": {"question": str(q)},
        "type": default_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _extract_question_text(q_entry: Union[str, Dict]) -> str:
    """Return human-readable question text from an entry that may be a string or dict."""
    if isinstance(q_entry, str):
        return q_entry
    if isinstance(q_entry, dict):
        q = q_entry.get("question") if "question" in q_entry else q_entry
        if isinstance(q, dict):
            return q.get("question") or q.get("title") or json.dumps(q)
        if isinstance(q, str):
            return q
    return str(q_entry)


class InterviewService:
    """Facade over engines and processors. Public API unchanged for callers."""

    def __init__(self) -> None:
        settings = get_settings()
        session_ttl = getattr(settings, "interview_session_ttl_seconds", 7200)

        self._engine = LLMEngine(settings)
        self.llm = self._engine.primary
        self.eval_llm = self._engine.eval_llm
        self._fallback_llm = self._engine.fallback

        self._prompt = PromptEngine(self._engine)
        self._questions = QuestionService(self._engine)
        self._jd_context = JDContextService(self._engine)
        self._resume_context = ResumeContextService()
        self._evaluator = AnswerEvaluator(self._engine)
        self._feedback = FeedbackService(self._engine)
        self._answers = AnswerProcessor(self._prompt, session_ttl)

    async def generate_greeting(self, candidate_name: str, role: str) -> str:
        return await self._prompt.generate_greeting(candidate_name, role)

    async def process_answer_and_generate_followup(
        self,
        session_id: str,
        user_answer: str,
        llm_context: str = "",
    ) -> Dict[str, Any]:
        return await self._answers.process_answer_and_generate_followup(session_id, user_answer, llm_context)

    async def prepare_followup(self, session_id: str, user_answer: str) -> Dict[str, Any]:
        return await self._answers.prepare_followup(session_id, user_answer)

    async def persist_followup_question(self, prepared: Dict[str, Any], next_question_text: str) -> Dict[str, Any]:
        return await self._answers.persist_followup_question(prepared, next_question_text)

    async def generate_first_question(
        self,
        interview_type: InterviewType,
        difficulty: DifficultyLevel,
        resume_data: Dict = None,
        custom_role: str = None,
        years_experience: Optional[int] = None,
        target_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        context = self._prompt._build_context(
            interview_type,
            resume_data,
            custom_role,
            years_experience,
            target_context=target_context,
        )
        return await self._questions.generate_first_question(interview_type, difficulty, context, custom_role)

    def _build_context(
        self,
        interview_type: InterviewType,
        resume_data: Dict = None,
        custom_role: str = None,
        years_experience: Optional[int] = None,
        target_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        return self._prompt._build_context(
            interview_type,
            resume_data,
            custom_role,
            years_experience,
            target_context=target_context,
        )

    async def build_jd_fit_context(
        self,
        *,
        target_company: Optional[str],
        target_role: str,
        job_description: str,
        interview_focus: str,
        resume_data: Optional[Dict[str, Any]] = None,
        years_experience: Optional[int] = None,
    ) -> Dict[str, Any]:
        return await self._jd_context.build_context(
            target_company=target_company,
            target_role=target_role,
            job_description=job_description,
            interview_focus=interview_focus,
            resume_data=resume_data,
            years_experience=years_experience,
        )

    def build_resume_probe_context(
        self,
        *,
        resume_data: Optional[Dict[str, Any]],
        years_experience: Optional[int] = None,
    ) -> Dict[str, Any]:
        return self._resume_context.build_context(
            resume_data=resume_data,
            years_experience=years_experience,
        )

    async def generate_resume_deep_dive_questions(
        self,
        *,
        difficulty: DifficultyLevel,
        context: str,
        probe_targets: List[Dict[str, Any]],
        count: int = 3,
    ) -> List[Dict[str, Any]]:
        return await self._questions.generate_resume_deep_dive_questions(
            difficulty=difficulty,
            context=context,
            probe_targets=probe_targets,
            count=count,
        )

    async def _generate_dsa_question(self, difficulty: DifficultyLevel, context: str) -> Dict[str, Any]:
        return await self._questions._generate_dsa_question(difficulty, context)

    async def analyze_response(
        self,
        question: str,
        candidate_response: str,
        interview_type: InterviewType,
    ) -> Dict[str, Any]:
        return await self._evaluator.analyze_response(question, candidate_response, interview_type)

    async def generate_follow_up(
        self,
        previous_qa: List[Dict],
        interview_type: InterviewType,
        llm_context: str = "",
    ) -> str:
        return await self._prompt.generate_follow_up(previous_qa, interview_type, llm_context=llm_context)

    async def generate_follow_up_stream(
        self,
        previous_qa: List[Dict],
        interview_type: InterviewType,
        llm_context: str = "",
    ) -> AsyncGenerator[str, None]:
        async for chunk in self._prompt.generate_follow_up_stream(previous_qa, interview_type, llm_context=llm_context):
            yield chunk

    async def evaluate_answer(
        self,
        question_asked: str,
        candidate_answer: str,
        answer_duration: float,
        code_written: str = "",
    ) -> Dict[str, Any]:
        return await self._evaluator.evaluate_answer(
            question_asked, candidate_answer, answer_duration, code_written
        )

    async def generate_final_feedback(self, session_data: Dict) -> Dict[str, Any]:
        return await self._feedback.generate_final_feedback(session_data)

    async def generate_replay_highlights(self, session_data: Dict) -> List[Dict[str, Any]]:
        return await self._feedback.generate_replay_highlights(session_data)
