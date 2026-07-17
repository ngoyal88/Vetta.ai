from typing import Dict, Any
from datetime import datetime, timezone

from config import get_settings
from utils.logger import get_logger
from services.interview.session_store import persist_ws_session_blob
from utils.redis_client import get_session
from services.interview.prompt_engine import PromptEngine
from services.interview.contracts.session_events import SessionEvent, SessionEventType
from services.interview.contracts.session_events import SessionEvent, SessionStateMachine

logger = get_logger("AnswerProcessor")


class AnswerProcessor:
    def __init__(self, prompt_engine: PromptEngine, session_ttl: int):
        self._prompt = prompt_engine
        self._session_ttl = session_ttl

    async def process_answer_and_generate_followup(
        self,
        session_id: str,
        user_answer: str,
        llm_context: str = "",
    ) -> Dict[str, Any]:
        """
        Processes user's answer, stores it, generates a follow-up question, and returns
        a structured question object suitable for UI / TTS.
        Returns a dict like:
        {
          "question": {...} or "question": "text",
          "type": "<type>",
          "timestamp": "..."
        }
        """
        try:
            prepared = await self.prepare_followup(session_id, user_answer)
            if prepared.get("done"):
                return prepared["response"]

            next_question_text = await self._prompt.generate_follow_up(
                prepared["responses"],
                prepared["interview_type"],
                llm_context=llm_context or prepared.get("llm_context", ""),
            )
            return await self.persist_followup_question(prepared, next_question_text)
        except Exception as e:
            logger.error(f"❌ Error processing answer: {e}", exc_info=True)
            return {"question": "I encountered an error. Could you please repeat your answer?", "type": "behavioral", "timestamp": datetime.now(timezone.utc).isoformat()}


    async def prepare_followup(self, session_id: str, user_answer: str) -> Dict[str, Any]:
        """Store the current answer and return context for generating the next question."""
        from services.interview.interview_service import _normalize_question_entry
        from services.interview.modes.registry import parse_interview_type

        session_key = f"interview:{session_id}"
        session_data = await get_session(session_key)
        if not session_data:
            logger.error(f"Session {session_id} not found")
            return {
                "done": True,
                "response": {
                    "question": "I couldn't find your interview session. Let's restart.",
                    "type": "behavioral",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }

        current_q_index = int(session_data.get("current_question_index", 0))
        questions = session_data.get("questions", []) or []
        if current_q_index >= len(questions):
            logger.info(f"Max questions reached for {session_id}")
            return {
                "done": True,
                "response": {
                    "question": "Thank you for your responses! That completes our interview for today.",
                    "type": "behavioral",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }

        interview_type = parse_interview_type(session_data.get("interview_type", "dsa"))
        normalized_current_question = _normalize_question_entry(
            questions[current_q_index],
            default_type=interview_type.value,
        )
        responses = session_data.get("responses", []) or []
        responses.append(
            {
                "question_index": current_q_index,
                "question": normalized_current_question,
                "response": user_answer,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        session_data["status"] = SessionStateMachine.transition(
            session_data.get("status", "active"),
            SessionEvent(type=SessionEventType.ANSWER_RECEIVED),
        ).value

        max_questions = get_settings().max_questions_per_interview
        if len(responses) >= max_questions:
            session_data["responses"] = responses
            session_data["current_question_index"] = current_q_index + 1
            await persist_ws_session_blob(session_key, session_data, session_ttl=self._session_ttl)
            logger.info(f"Max questions ({max_questions}) reached for {session_id}")
            return {
                "done": True,
                "response": {
                    "question": "Thank you for your responses! That completes our interview for today.",
                    "type": "behavioral",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }

        return {
            "done": False,
            "session_key": session_key,
            "session_data": session_data,
            "questions": questions,
            "responses": responses,
            "current_q_index": current_q_index,
            "interview_type": interview_type,
            "current_question": normalized_current_question,
        }


    async def persist_followup_question(self, prepared: Dict[str, Any], next_question_text: str) -> Dict[str, Any]:
        """Persist the generated follow-up question and return the wrapped object."""
        next_question_obj = {
            "question": {"question": (next_question_text or "").strip()},
            "type": prepared["interview_type"].value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        prepared["questions"].append(next_question_obj)
        prepared["session_data"]["questions"] = prepared["questions"]
        prepared["session_data"]["responses"] = prepared["responses"]
        prepared["session_data"]["current_question_index"] = prepared["current_q_index"] + 1
        await persist_ws_session_blob(
            prepared["session_key"],
            prepared["session_data"],
            session_ttl=self._session_ttl,
        )
        logger.info(
            "✅ Stored response for Q%s and generated next question.",
            prepared["current_q_index"],
        )
        return next_question_obj


