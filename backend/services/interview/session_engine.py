"""Transport-agnostic interview state machine."""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, TYPE_CHECKING, Union

from firebase_admin import firestore

from firebase_config import db
from models.interview import DifficultyLevel, InterviewType
from services.interview.session_conductor import SessionConductor
from utils.feedback_parser import parse_scores_from_feedback
from utils.logger import get_logger
from utils.redis_client import get_session, redis as redis_client, update_session

if TYPE_CHECKING:
    from config import Settings
    from services.interview.interview_service import InterviewService
    from services.interview.transport_protocol import ITransport

logger = get_logger("InterviewSessionEngine")


class InterviewPhase(str, Enum):
    GREETING = "greeting"
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    DSA_CODING = "dsa"
    WRAP_UP = "wrap_up"
    FEEDBACK = "feedback"
    ENDED = "ended"


def _get_dsa_inner_question(payload: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return None
    if payload.get("type") == "coding" and isinstance(payload.get("question"), dict):
        return payload["question"]
    if isinstance(payload.get("title"), str) and "test_cases" in payload:
        return payload
    return None


def _extract_resume_name(resume_data: Any) -> Optional[str]:
    if not isinstance(resume_data, dict):
        return None
    name = resume_data.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    if isinstance(name, dict):
        raw = name.get("raw")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


class InterviewSessionEngine:
    def __init__(
        self,
        session_id: str,
        user_id: str,
        transport: "ITransport",
        interview_service: "InterviewService",
        settings: "Settings",
    ) -> None:
        self.session_id = session_id
        self.user_id = user_id
        self.transport = transport
        self.interview_service = interview_service
        self.settings = settings
        self.session_key = f"interview:{session_id}"
        self.session_ttl = getattr(settings, "interview_session_ttl_seconds", 7200)

        self.current_phase: str = InterviewPhase.GREETING.value
        self.conductor = SessionConductor()
        self.is_processing = False
        self.processing_lock = asyncio.Lock()
        self.current_answer_parts: List[str] = []
        self.latest_interim_transcript: str = ""
        self._session_started_at: Optional[datetime] = None
        self._first_question: Optional[Dict[str, Any]] = None
        self._prebuilt_context: Optional[str] = None
        self._utterance_finalize_task: Optional[asyncio.Task] = None
        self._prebuild_task: Optional[asyncio.Task] = None
        self._last_transcript_confidence: Optional[float] = None
        self._current_answer_started_at: Optional[float] = None
        self._streaming_llm_enabled = bool(getattr(settings, "streaming_llm_enabled", True))
        self._finalize_used_stream_followup = False

    async def initialize(self, *, skip_greeting: bool = False) -> None:
        session_data = await get_session(self.session_key)
        if not session_data:
            await self.transport.send_error("Session not found")
            return

        self.conductor = SessionConductor.load(session_data.get("session_conductor"))
        started_at_raw = session_data.get("started_at")
        if isinstance(started_at_raw, str):
            try:
                self._session_started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
            except Exception:
                self._session_started_at = datetime.now(timezone.utc)
        elif isinstance(started_at_raw, datetime):
            self._session_started_at = (
                started_at_raw if started_at_raw.tzinfo else started_at_raw.replace(tzinfo=timezone.utc)
            )
        else:
            self._session_started_at = datetime.now(timezone.utc)
        if self._session_started_at:
            self.conductor.session_start_time = self._session_started_at.timestamp()

        await self.transport.send_status("connected")
        if not skip_greeting:
            await self._start_greeting(session_data)

    async def on_transcript(self, text: str, is_final: bool, confidence: Optional[float] = None) -> None:
        await self.transport.send_transcript(text, is_final)
        self._last_transcript_confidence = confidence if is_final else self._last_transcript_confidence
        if not is_final:
            self.latest_interim_transcript = text
            self.conductor.latest_interim_transcript = text
            return

        final_segment = text.strip()
        if final_segment:
            self.current_answer_parts.append(final_segment)
            self.conductor.current_answer_parts.append(final_segment)
        self.latest_interim_transcript = ""
        self.conductor.latest_interim_transcript = ""

    async def on_utterance_end(self, last_word_end: Optional[int] = None) -> None:
        if self.current_phase == InterviewPhase.GREETING.value:
            return
        if self._utterance_finalize_task and not self._utterance_finalize_task.done():
            self._utterance_finalize_task.cancel()
        self._prebuild_task = asyncio.create_task(self._prebuild_llm_context_async())
        await self.transport.send_message({"type": "interviewer_thinking"})
        self._utterance_finalize_task = asyncio.create_task(self._debounced_utterance_finalize())

    async def _prebuild_llm_context_async(self) -> None:
        try:
            self._prebuilt_context = self.conductor.build_llm_context()
        except Exception:
            self._prebuilt_context = None

    async def schedule_prebuild_context(self) -> None:
        self._prebuild_task = asyncio.create_task(self._prebuild_llm_context_async())

    async def _ensure_prebuilt(self) -> None:
        if self._prebuild_task and not self._prebuild_task.done():
            try:
                await self._prebuild_task
            except asyncio.CancelledError:
                pass
        elif self._prebuilt_context is None:
            await self._prebuild_llm_context_async()

    async def _debounced_utterance_finalize(self) -> None:
        try:
            await asyncio.sleep(0.15)
            await asyncio.gather(self._ensure_prebuilt(), return_exceptions=True)
            if not (self.current_answer_parts or (self.latest_interim_transcript or "").strip()):
                return
            if not self.transport.connected:
                return
            await self.transport.send_message(
                {
                    "type": "utterance_end_detected",
                    "transcript": " ".join(self.current_answer_parts).strip(),
                }
            )
            await self._finalize_current_answer()
        except asyncio.CancelledError:
            pass

    async def finalize_answer(self) -> None:
        await self._finalize_current_answer()

    async def on_code_update(self, code: str, language: str, changed_at: float) -> None:
        self.conductor.update_code(code, language=language, changed_at=changed_at)
        await self._persist_conductor()

    async def on_execution_result(self, output: str, has_errors: bool) -> None:
        self.conductor.update_execution(output, has_errors)
        await self._persist_conductor()

    async def on_skip_question(self) -> None:
        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                await self.transport.send_error("Session not found")
                return

            questions = session_data.get("questions", []) or []
            current_q_index = int(session_data.get("current_question_index", 0))
            try:
                interview_type = InterviewType(session_data.get("interview_type", "dsa"))
            except Exception:
                interview_type = InterviewType.DSA
            try:
                difficulty = DifficultyLevel(session_data.get("difficulty", "medium"))
            except Exception:
                difficulty = DifficultyLevel.MEDIUM

            responses = session_data.get("responses", []) or []
            skipped_question = questions[current_q_index] if current_q_index < len(questions) else None
            if skipped_question:
                responses.append(
                    {
                        "question_index": current_q_index,
                        "question": skipped_question,
                        "response": "[skipped by user]",
                        "skipped": True,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )

            if interview_type == InterviewType.DSA:
                context = self.interview_service._build_context(
                    interview_type,
                    session_data.get("resume_data"),
                    session_data.get("custom_role"),
                    session_data.get("years_experience"),
                )
                next_question_raw = await self.interview_service._generate_dsa_question(difficulty, context)
                next_question_obj = {
                    "question": next_question_raw,
                    "type": "coding",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            else:
                follow_up_text = await self.interview_service.generate_follow_up(responses, interview_type)
                next_question_obj = {
                    "question": {"question": follow_up_text},
                    "type": interview_type.value,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

            questions.append(next_question_obj)
            session_data["questions"] = questions
            session_data["responses"] = responses
            session_data["current_question_index"] = current_q_index + 1
            session_data["last_updated"] = datetime.now(timezone.utc).isoformat()
            session_data["session_conductor"] = self.conductor.serialize()
            await update_session(self.session_key, session_data, expire_seconds=self.session_ttl)

            if next_question_obj.get("type") == "coding":
                self.current_phase = InterviewPhase.DSA_CODING.value
                self._set_conductor_phase_str(self.current_phase)
                self.conductor.append_turn("interviewer", self._extract_speakable_text(next_question_obj))
                await self.transport.send_message({"type": "phase_change", "phase": "dsa"})
                inner = _get_dsa_inner_question(next_question_obj) or next_question_obj
                await self.transport.send_message(
                    {
                        "type": "question",
                        "question": inner,
                        "phase": "dsa",
                        "audio": None,
                        "spoken_text": None,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                await self._persist_conductor(session_data)
            else:
                await self._speak_response(next_question_obj)
                await self._persist_conductor()
        except Exception as e:
            logger.error("Skip question error: %s", e, exc_info=True)
            await self.transport.send_error("Failed to skip question")

    async def on_dsa_next_question(self) -> None:
        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                await self.transport.send_error("Session not found")
                return
            questions = session_data.get("questions", []) or []
            current_q_index = int(session_data.get("current_question_index", 0))
            try:
                difficulty = DifficultyLevel(session_data.get("difficulty", "medium"))
            except Exception:
                difficulty = DifficultyLevel.MEDIUM
            context = self.interview_service._build_context(
                InterviewType.DSA,
                session_data.get("resume_data"),
                session_data.get("custom_role"),
                session_data.get("years_experience"),
            )
            next_question_raw = await self.interview_service._generate_dsa_question(difficulty, context)
            next_question_obj = {
                "question": next_question_raw,
                "type": "coding",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            questions.append(next_question_obj)
            session_data["questions"] = questions
            session_data["current_question_index"] = current_q_index + 1
            session_data["last_updated"] = datetime.now(timezone.utc).isoformat()
            session_data["session_conductor"] = self.conductor.serialize()
            await update_session(self.session_key, session_data, expire_seconds=self.session_ttl)
            self.current_phase = InterviewPhase.DSA_CODING.value
            self._set_conductor_phase_str(self.current_phase)
            self.conductor.append_turn("interviewer", self._extract_speakable_text(next_question_raw))
            await self.transport.send_message({"type": "phase_change", "phase": "dsa"})
            await self.transport.send_message(
                {
                    "type": "question",
                    "question": next_question_raw,
                    "phase": "dsa",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            await self._persist_conductor(session_data)
        except Exception as e:
            logger.error("dsa_next_question error: %s", e, exc_info=True)
            await self.transport.send_error("Failed to load next question")

    async def on_end_interview(self) -> None:
        if self.current_phase == InterviewPhase.ENDED.value:
            return
        feedback_lock_key = f"feedback_generating:{self.session_id}"
        try:
            acquired = await redis_client.set(feedback_lock_key, "1", nx=True, ex=120)
        except Exception as e:
            logger.warning("Could not acquire feedback lock: %s", e)
            acquired = False
        if not acquired:
            logger.info("Feedback already being generated for session %s, skipping", self.session_id)
            return

        self.current_phase = InterviewPhase.FEEDBACK.value
        self._set_conductor_phase_str(self.current_phase)
        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                await self.transport.send_error("Session not found")
                return

            started_at_raw = session_data.get("started_at")
            started_at: Optional[datetime] = None
            if isinstance(started_at_raw, str):
                try:
                    started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
                except Exception:
                    started_at = None
            elif isinstance(started_at_raw, datetime):
                started_at = started_at_raw
            if not started_at:
                started_at = datetime.now(timezone.utc)

            duration_minutes = int(max(0, (datetime.now(timezone.utc) - started_at).total_seconds() / 60))
            feedback_payload = {
                "interview_type": session_data.get("interview_type"),
                "custom_role": session_data.get("custom_role"),
                "duration": duration_minutes,
                "responses": session_data.get("responses", []),
                "code_submissions": session_data.get("code_submissions", []),
            }
            final_feedback = await self.interview_service.generate_final_feedback(feedback_payload)
            scores = parse_scores_from_feedback(
                final_feedback.get("feedback") if isinstance(final_feedback, dict) else None
            )

            completion_reason = "ended_early" if session_data.get("status") != "completed" else "completed"
            completed_ts = datetime.now(timezone.utc).isoformat()

            session_data["status"] = "ended_early"
            session_data["completion_reason"] = completion_reason
            session_data["completed_at"] = completed_ts
            session_data["last_updated"] = completed_ts
            session_data["final_feedback"] = final_feedback
            session_data["duration_minutes"] = duration_minutes
            session_data["questions_answered"] = len(session_data.get("responses", []))
            session_data["code_problems_attempted"] = len(session_data.get("code_submissions", []))
            session_data["session_conductor"] = self.conductor.serialize()
            await update_session(self.session_key, session_data, expire_seconds=self.session_ttl)

            try:
                db.collection("interviews").document(self.session_id).set(
                    {
                        "status": "ended_early",
                        "completion_reason": completion_reason,
                        "completed_at": firestore.SERVER_TIMESTAMP,
                        "last_updated": firestore.SERVER_TIMESTAMP,
                        "duration_minutes": duration_minutes,
                        "questions_answered": session_data["questions_answered"],
                        "code_problems_attempted": session_data["code_problems_attempted"],
                        "responses": session_data.get("responses", []),
                        "questions": session_data.get("questions", []),
                        "code_submissions": session_data.get("code_submissions", []),
                        "final_feedback": final_feedback,
                        "scores": scores or None,
                    },
                    merge=True,
                )
            except Exception as fe:
                logger.warning("Firestore persist failed: %s", fe)

            await self.transport.send_message(
                {
                    "type": "feedback",
                    "feedback": final_feedback.get("feedback") if isinstance(final_feedback, dict) else final_feedback,
                    "full": final_feedback,
                    "duration_minutes": duration_minutes,
                    "questions_answered": session_data["questions_answered"],
                    "code_problems_attempted": session_data["code_problems_attempted"],
                    "status": "ended_early",
                    "timestamp": completed_ts,
                }
            )
            await self.transport.send_status("completed")
        except Exception as e:
            logger.error("Error ending interview: %s", e, exc_info=True)
            await self.transport.send_error("Failed to finalize interview")
        finally:
            self.current_phase = InterviewPhase.ENDED.value
            self._set_conductor_phase_str(self.current_phase)

    async def on_candidate_disconnect(self) -> None:
        try:
            await asyncio.sleep(90)
        except asyncio.CancelledError:
            logger.info("Candidate reconnected, cancelling disconnect flow for session %s", self.session_id)
            return
        try:
            session_data = await get_session(self.session_key)
            if not session_data:
                return
            session_data["status"] = "incomplete_exit"
            session_data["completion_reason"] = "candidate_disconnected"
            completed_ts = datetime.now(timezone.utc).isoformat()
            session_data["completed_at"] = completed_ts
            session_data["last_updated"] = completed_ts
            turn_count = len(session_data.get("responses", []))
            if turn_count >= 2:
                try:
                    started_at_raw = session_data.get("started_at")
                    started_at = None
                    if isinstance(started_at_raw, str):
                        try:
                            started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
                        except Exception:
                            pass
                    elif isinstance(started_at_raw, datetime):
                        started_at = started_at_raw
                    if not started_at:
                        started_at = datetime.now(timezone.utc)
                    duration_minutes = int(max(0, (datetime.now(timezone.utc) - started_at).total_seconds() / 60))
                    feedback_payload = {
                        "interview_type": session_data.get("interview_type"),
                        "custom_role": session_data.get("custom_role"),
                        "duration": duration_minutes,
                        "responses": session_data.get("responses", []),
                        "code_submissions": session_data.get("code_submissions", []),
                    }
                    final_feedback = await asyncio.wait_for(
                        self.interview_service.generate_final_feedback(feedback_payload),
                        45.0,
                    )
                    session_data["final_feedback"] = final_feedback
                except (asyncio.TimeoutError, Exception) as e:
                    logger.warning("Partial feedback generation failed: %s", e)
            session_data["questions_answered"] = len(session_data.get("responses", []))
            session_data["code_problems_attempted"] = len(session_data.get("code_submissions", []))
            await update_session(self.session_key, session_data, expire_seconds=self.session_ttl)
            try:
                scores = parse_scores_from_feedback(
                    session_data.get("final_feedback", {}).get("feedback")
                    if isinstance(session_data.get("final_feedback"), dict)
                    else None
                )
                db.collection("interviews").document(self.session_id).set(
                    {
                        "status": "incomplete_exit",
                        "completion_reason": "candidate_disconnected",
                        "completed_at": firestore.SERVER_TIMESTAMP,
                        "last_updated": firestore.SERVER_TIMESTAMP,
                        "questions_answered": session_data["questions_answered"],
                        "code_problems_attempted": session_data["code_problems_attempted"],
                        "responses": session_data.get("responses", []),
                        "questions": session_data.get("questions", []),
                        "code_submissions": session_data.get("code_submissions", []),
                        "final_feedback": session_data.get("final_feedback"),
                        "scores": scores,
                    },
                    merge=True,
                )
            except Exception as fe:
                logger.warning("Firestore persist on disconnect failed: %s", fe)
        finally:
            pass

    async def on_candidate_reconnect(self) -> None:
        session_data = await get_session(self.session_key)
        if session_data:
            self.conductor = SessionConductor.load(session_data.get("session_conductor"))
        await self.transport.send_status("reconnected")
        await self.transport.speak("Welcome back. Ready to continue where we left off?", {})

    async def on_silence_tier(self, tier: int, seconds_silent: int) -> None:
        if tier == 1:
            await self.transport.send_message({"type": "silence_warning", "tier": 1, "seconds_silent": seconds_silent})
            await self.transport.speak("Take your time. When you're ready, just start speaking.", {})
        elif tier == 2:
            await self.transport.send_message({"type": "silence_warning", "tier": 2, "seconds_silent": seconds_silent})
            await self.transport.speak("Would you like me to rephrase the question?", {})
        elif tier >= 3:
            await self.transport.send_message({"type": "silence_warning", "tier": 3, "seconds_silent": seconds_silent})
            await self.on_end_interview()

    def mark_answer_window_started(self) -> None:
        self._current_answer_started_at = self._current_answer_started_at or time.monotonic()

    def on_candidate_speech_started(self) -> None:
        if self._utterance_finalize_task and not self._utterance_finalize_task.done():
            self._utterance_finalize_task.cancel()
        if self._prebuild_task and not self._prebuild_task.done():
            self._prebuild_task.cancel()
        self._prebuilt_context = None

    def clear_interim_for_interrupt(self) -> None:
        self.latest_interim_transcript = ""
        self.conductor.latest_interim_transcript = ""

    async def on_paste_detected(self) -> None:
        setattr(self.conductor, "large_paste_occurred", True)
        await self._persist_conductor()

    async def on_text_answer(self, text: str) -> None:
        clean = (text or "").strip()
        if len(clean) < 3:
            await self.transport.send_error("Please enter at least 3 characters.")
            return
        self.current_answer_parts = [clean]
        self.conductor.current_answer_parts = [clean]
        self.latest_interim_transcript = ""
        self.conductor.latest_interim_transcript = ""
        await self._finalize_current_answer()

    async def cleanup(self) -> None:
        if self._utterance_finalize_task and not self._utterance_finalize_task.done():
            self._utterance_finalize_task.cancel()
        if self._prebuild_task and not self._prebuild_task.done():
            self._prebuild_task.cancel()

    def _build_complete_answer(self) -> str:
        parts = list(self.current_answer_parts)
        interim = (self.latest_interim_transcript or "").strip()
        if interim:
            parts.append(interim)
        return " ".join([p for p in parts if p]).strip()

    def _is_dsa_session(self, session_data: dict) -> bool:
        it = session_data.get("interview_type") or ""
        return str(it).lower() == "dsa"

    def _set_conductor_phase_str(self, phase: str) -> None:
        self.conductor.session_phase = "dsa" if phase == InterviewPhase.DSA_CODING.value else phase

    def _extract_speakable_text(self, response: Any) -> str:
        if isinstance(response, str):
            return response
        if isinstance(response, dict):
            if response.get("type") == "coding":
                inner = _get_dsa_inner_question(response) or response
                title = inner.get("title", "") if isinstance(inner, dict) else ""
                description = inner.get("description", "") if isinstance(inner, dict) else ""
                if title or description:
                    return f"{title}. {str(description)[:200]}..."
                title = response.get("title", "")
                description = response.get("description", "")
                return f"{title}. {description[:200]}..."
            question = response.get("question")
            if isinstance(question, dict):
                return str(question.get("question", ""))
            if isinstance(question, str):
                return question
        return str(response)

    async def _persist_conductor(self, session_data: Optional[Dict[str, Any]] = None) -> None:
        snapshot = session_data if session_data is not None else await get_session(self.session_key)
        if not snapshot:
            return
        snapshot["session_conductor"] = self.conductor.serialize()
        await update_session(self.session_key, snapshot, expire_seconds=self.session_ttl)

    async def persist_conductor(self, session_data: Optional[Dict[str, Any]] = None) -> None:
        await self._persist_conductor(session_data)

    async def _check_max_duration(self) -> bool:
        max_duration_min = getattr(self.settings, "max_interview_duration_minutes", 60)
        if not self._session_started_at or max_duration_min <= 0:
            return False
        elapsed_min = (datetime.now(timezone.utc) - self._session_started_at).total_seconds() / 60
        if elapsed_min >= max_duration_min:
            logger.info("Max interview duration (%s min) reached for %s", max_duration_min, self.session_id)
            await self.on_end_interview()
            return True
        return False

    async def _start_greeting(self, session_data: Dict[str, Any]) -> None:
        try:
            questions = session_data.get("questions", []) or []
            first_question = questions[0] if questions else None
            if not first_question:
                await self.transport.send_error("No questions available")
                return

            if self._is_dsa_session(session_data):
                inner = _get_dsa_inner_question(first_question) or first_question
                test_cases = inner.get("test_cases") if isinstance(inner, dict) else []
                if not test_cases or not isinstance(test_cases, list):
                    await self.transport.send_error("No valid coding question available")
                    return
                self._first_question = first_question
                self.current_phase = InterviewPhase.DSA_CODING.value
                self._set_conductor_phase_str(self.current_phase)
                self.conductor.append_turn("interviewer", self._extract_speakable_text(inner))
                await self.transport.send_message({"type": "phase_change", "phase": "dsa"})
                await self.transport.send_message(
                    {
                        "type": "question",
                        "question": inner,
                        "phase": "dsa",
                        "audio": None,
                        "spoken_text": None,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                await self._persist_conductor(session_data)
                return

            self.current_phase = InterviewPhase.GREETING.value
            self._set_conductor_phase_str(self.current_phase)
            user_name = (
                session_data.get("candidate_name")
                or _extract_resume_name(session_data.get("resume_data"))
                or session_data.get("user_id", "Candidate")
            )
            interview_type = session_data.get("interview_type", "technical")
            custom_role = session_data.get("custom_role")
            role = custom_role or interview_type

            greeting = await self.interview_service.generate_greeting(user_name, role)
            self._first_question = first_question
            await self._speak_response(greeting)
            await self._persist_conductor()
        except Exception as e:
            logger.error("Greeting error: %s", e, exc_info=True)
            await self.transport.send_error("Failed to start interview")

    async def _speak_response(self, response: Union[str, Dict[str, Any]]) -> None:
        speak_text = self._extract_speakable_text(response)
        if isinstance(response, dict) and response.get("type") == "coding":
            if self.current_phase != InterviewPhase.DSA_CODING.value:
                await self.transport.send_message({"type": "phase_change", "phase": "dsa"})
            self.current_phase = InterviewPhase.DSA_CODING.value
            self._set_conductor_phase_str(self.current_phase)
        elif self.current_phase == InterviewPhase.DSA_CODING.value:
            self.current_phase = InterviewPhase.BEHAVIORAL.value
            self._set_conductor_phase_str(self.current_phase)
            await self.transport.send_message({"type": "phase_change", "phase": "behavioral"})

        payload: Dict[str, Any] = {"response": response} if not isinstance(response, str) else {"text": response}
        await self.transport.speak(speak_text, payload)

    async def _finalize_current_answer(self) -> None:
        if self.current_phase == InterviewPhase.DSA_CODING.value:
            return

        complete_text = self._build_complete_answer()

        self.current_answer_parts.clear()
        self.latest_interim_transcript = ""
        self.conductor.current_answer_parts.clear()
        self.conductor.latest_interim_transcript = ""

        if not complete_text or len(complete_text) < 3:
            await self.transport.send_status("waiting_for_speech")
            await self.transport.send_error("No answer captured yet. Please speak a bit more.")
            return
        if len(complete_text) > 10_000:
            await self.transport.send_error("Answer is too long. Please summarize.")
            return

        if await self._check_max_duration():
            return

        if self._last_transcript_confidence is not None and self._last_transcript_confidence < 0.4 and len(complete_text) < 10:
            await self.transport.send_error("We didn't quite catch that. Could you repeat?")
            return

        answer_duration = 0.0
        if self._current_answer_started_at is not None:
            answer_duration = max(0.0, time.monotonic() - self._current_answer_started_at)
        self._current_answer_started_at = None
        self.conductor.last_answer_duration = answer_duration
        self.conductor.turn_count += 1
        self.conductor.append_turn("candidate", complete_text)

        try:
            await asyncio.wait_for(self.processing_lock.acquire(), timeout=0)
        except asyncio.TimeoutError:
            return

        self.is_processing = True
        self._finalize_used_stream_followup = False
        try:
            await self._finalize_after_lock(complete_text, answer_duration)
        except asyncio.TimeoutError:
            await self.transport.send_error("Processing timeout")
        except Exception as e:
            logger.error("Processing error: %s", e, exc_info=True)
            await self.transport.send_error("Failed to process answer")
        finally:
            self.is_processing = False
            self._prebuilt_context = None
            self.processing_lock.release()
            fn = getattr(self.transport, "after_answer_processed", None)
            if callable(fn):
                await fn()
            elif not self._finalize_used_stream_followup:
                await self.transport.send_status("listening")

    async def _finalize_after_lock(self, complete_text: str, answer_duration: float) -> None:
        if self.current_phase == InterviewPhase.GREETING.value:
            await self.transport.send_status("thinking")
            session_data = await get_session(self.session_key)
            if session_data is not None:
                session_data["candidate_intro"] = complete_text
                session_data["session_conductor"] = self.conductor.serialize()
                await update_session(self.session_key, session_data, expire_seconds=self.session_ttl)

            first_question = self._first_question
            if first_question is None and session_data:
                qs = session_data.get("questions", []) or []
                if qs:
                    first_question = qs[0]
            if not first_question:
                await self.transport.send_error("No questions available")
                return

            self.current_phase = InterviewPhase.BEHAVIORAL.value
            self._set_conductor_phase_str(self.current_phase)
            await self._persist_conductor(session_data)
            await self._speak_response(first_question)
            return

        await self.transport.send_status("thinking")

        stream_fn = getattr(self.transport, "stream_followup_prepared", None)
        if self._streaming_llm_enabled and callable(stream_fn):
            self._finalize_used_stream_followup = True
            prepared = await self.interview_service.prepare_followup(self.session_id, complete_text)
            if prepared.get("done"):
                await self._speak_response(prepared["response"])
                return
            current_question = prepared.get("current_question", {})
            if isinstance(current_question, dict):
                question_payload = current_question.get("question", current_question)
                if isinstance(question_payload, dict):
                    question_text = question_payload.get("question") or question_payload.get("title") or ""
                else:
                    question_text = str(question_payload)
            else:
                question_text = str(current_question)
            evaluation = await self.interview_service.evaluate_answer(
                question_text,
                complete_text,
                answer_duration,
                self.conductor.current_code,
            )
            self.conductor.update_from_answer(complete_text, evaluation)
            prepared["llm_context"] = (
                f"{self._prebuilt_context or self.conductor.build_llm_context()}\n"
                f"LATEST ANSWER EVALUATION:\n"
                f"- Quality: {evaluation.get('quality')}\n"
                f"- Completeness: {evaluation.get('completeness')}\n"
                f"- What was good: {evaluation.get('what_was_good')}\n"
                f"- What was missing: {evaluation.get('what_was_missing')}\n"
                f"- Detected misconception: {evaluation.get('detected_misconception')}\n"
                f"- Confidence signal: {evaluation.get('confidence_signal')}\n"
                f"- Recommended action: {evaluation.get('recommended_action')}\n"
            )
            prepared["evaluation"] = evaluation
            prepared["backchannel"] = self.conductor.get_backchannel(self._choose_backchannel_tone())
            sd = prepared.get("session_data") or await get_session(self.session_key)
            if sd:
                sd["session_conductor"] = self.conductor.serialize()
                prepared["session_data"] = sd
            await asyncio.wait_for(stream_fn(prepared), timeout=45.0)
            return

        response = await asyncio.wait_for(
            self.interview_service.process_answer_and_generate_followup(
                self.session_id,
                complete_text,
                llm_context=self._prebuilt_context or self.conductor.build_llm_context(),
            ),
            timeout=30.0,
        )
        await self._speak_response(response)
        await self._persist_conductor()

    def _choose_backchannel_tone(self) -> str:
        if self.conductor.last_recommended_action in {"CHALLENGE", "ADVANCE"}:
            return "positive"
        if self.conductor.last_recommended_action in {"PROBE", "SIMPLIFY", "HINT"}:
            return "probe"
        return "neutral"
