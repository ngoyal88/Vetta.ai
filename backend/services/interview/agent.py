"""LiveKit Agents entrypoint for the Vetta.ai AI Interviewer.

AgentServer registers with LiveKit Cloud and dispatches an AgentSession per room.
Room name equals session_id; session data must exist in Redis before the user joins.
Pipeline: Deepgram STT → Groq LLM → Edge TTS (via EdgeTTSPlugin) → Silero VAD.
"""
import asyncio
import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from config import get_settings
from firebase_admin import firestore
from firebase_config import db
from models.interview import DifficultyLevel, InterviewType
from services.interview.contracts.session_events import SessionEvent, SessionEventType
from services.interview.contracts.fallback_contracts import InterviewEndedEvent, SessionStatusEvent
from services.interview.interview_service import InterviewService
from services.interview.session_conductor import SessionConductor
from services.interview.session_state_machine import SessionStateMachine
from services.interview.transcript_service import attach_transcript_to_session, extract_assistant_transcript_text
from utils.feedback_parser import parse_scores_from_feedback
from utils.logger import get_logger
from redis.asyncio import Redis

from livekit.agents import Agent, AgentServer, AgentSession, AutoSubscribe, JobContext, JobProcess, llm
from livekit.plugins import deepgram, groq, silero

settings = get_settings()
log = get_logger("InterviewAgent")

SESSION_TTL = getattr(settings, "interview_session_ttl_seconds", 7200)
CODE_PAYLOAD_MAX_LENGTH = 100_000

server = AgentServer(
    ws_url=settings.livekit_url,
    api_key=settings.livekit_api_key,
    api_secret=settings.livekit_api_secret,
    initialize_process_timeout=60.0,
)


def _prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = _prewarm

_worker_redis: Optional[Redis] = None
_worker_redis_loop: Optional[asyncio.AbstractEventLoop] = None


def _redis_url() -> str:
    url = (os.environ.get("REDIS_URL") or getattr(settings, "redis_url", "") or "").strip()
    if url.lower().startswith("https://"):
        return "rediss://" + url[8:]
    return url


async def _ensure_redis() -> Redis:
    global _worker_redis, _worker_redis_loop
    loop = asyncio.get_running_loop()
    if _worker_redis is not None and _worker_redis_loop is loop:
        return _worker_redis
    if _worker_redis is not None:
        try:
            await _worker_redis.aclose()
        except Exception:
            pass
    url = _redis_url()
    if url:
        _worker_redis = Redis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=10,
            socket_keepalive=True,
            health_check_interval=30,
        )
    else:
        _worker_redis = Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password or os.getenv("REDIS_PASSWORD") or None,
            db=getattr(settings, "redis_db", 0),
            decode_responses=True,
            ssl=getattr(settings, "redis_ssl", False),
        )
    _worker_redis_loop = loop
    return _worker_redis


async def _get_session(session_key: str) -> Optional[Dict[str, Any]]:
    try:
        redis = await _ensure_redis()
        raw = await redis.get(session_key)
        return json.loads(raw) if raw else None
    except Exception as e:
        log.error("Error retrieving session %s: %s", session_key, e, exc_info=True)
        return None


async def _update_session(session_key: str, data: Dict[str, Any], ttl: int = SESSION_TTL) -> None:
    try:
        redis = await _ensure_redis()
        await redis.set(session_key, json.dumps(data, default=str), ex=ttl)
    except Exception as e:
        log.error("Error updating session %s: %s", session_key, e, exc_info=True)


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


def _build_system_prompt(session_data: Dict[str, Any], conductor: SessionConductor) -> str:
    candidate_name = (
        session_data.get("candidate_name")
        or _extract_resume_name(session_data.get("resume_data"))
        or "Candidate"
    )
    interview_type = str(session_data.get("interview_type") or "technical")
    difficulty = str(session_data.get("difficulty") or "medium")
    custom_role = (session_data.get("custom_role") or "").strip()
    role_line = f"Custom role focus: {custom_role}" if custom_role else "Custom role focus: none"
    target_company = session_data.get("target_company") or ""
    target_role = session_data.get("target_role") or ""
    interview_focus = session_data.get("interview_focus") or ""
    jd_fit_context = session_data.get("jd_fit_context") or {}
    resume_probe_context = session_data.get("resume_probe_context") or {}
    jd_summary = jd_fit_context.get("summary") if isinstance(jd_fit_context, dict) else ""
    probing_areas = jd_fit_context.get("probing_areas") if isinstance(jd_fit_context, dict) else []
    resume_summary = resume_probe_context.get("summary") if isinstance(resume_probe_context, dict) else ""
    resume_probing_areas = (
        resume_probe_context.get("probing_areas")
        if isinstance(resume_probe_context, dict)
        else []
    )
    resume_probe_targets = (
        resume_probe_context.get("probe_targets")
        if isinstance(resume_probe_context, dict)
        else []
    )
    target_lines = ""
    if target_role or target_company:
        target_lines = (
            f"\nTarget company: {target_company or 'not specified'}"
            f"\nTarget role: {target_role or custom_role or 'not specified'}"
            f"\nInterview focus: {interview_focus or 'mixed'}"
        )
    if jd_summary:
        target_lines += f"\nJD fit summary: {jd_summary}"
    if isinstance(probing_areas, list) and probing_areas:
        target_lines += f"\nPriority probing areas: {', '.join([str(p) for p in probing_areas[:6]])}"
    if resume_summary:
        target_lines += f"\nResume deep-dive summary: {resume_summary}"
    if isinstance(resume_probing_areas, list) and resume_probing_areas:
        target_lines += f"\nResume probing areas: {', '.join([str(p) for p in resume_probing_areas[:6]])}"
    if isinstance(resume_probe_targets, list) and resume_probe_targets:
        probe_labels = []
        for target in resume_probe_targets[:5]:
            if isinstance(target, dict):
                probe_labels.append(str(target.get("label") or target.get("kind") or "resume item"))
        if probe_labels:
            target_lines += f"\nPlanned resume targets: {', '.join(probe_labels)}"

    role_targeted_rule = ""
    if str(interview_type).lower() == "role_targeted":
        role_targeted_rule = (
            "\nThis is a role-targeted loop: stay anchored to the target company, role, "
            "any job description provided, and probing areas. Do not drift into generic trivia."
        )
    resume_deep_dive_rule = ""
    if str(interview_type).lower() == "resume":
        resume_deep_dive_rule = (
            "\nThis session is resume-based. Every question should trace back to a specific item "
            "in the candidate's history. Probe for metrics, tradeoffs, and direct ownership."
        )

    return f"""You are a senior software engineer conducting a real technical interview.
You are not a question dispenser. You are a person having a conversation.

Your personality:
- Curious and direct. You ask because you genuinely want to understand.
- Patient but not passive. If an answer is incomplete, you probe.
- You push harder when someone is doing well. You back off when they're lost.
- You occasionally say "hmm" or pause. You're thinking too.
- You never say "Great answer!" or "Excellent!" — it sounds fake.
  Instead: "Right.", "Okay, that makes sense.", "Interesting." or nothing.
- You reference things said earlier. You remember the whole conversation.
- When the candidate is coding, you acknowledge what you see on screen.

Your one rule:
Always react to what was JUST said before asking anything new.
Never jump to the next question without acknowledging the last answer.
Even a single word ("Right.") is enough. Never skip this.

Candidate: {candidate_name}
Interview type: {interview_type}
Difficulty: {difficulty}
{role_line}
{target_lines}{role_targeted_rule}{resume_deep_dive_rule}
"""


class InterviewerAgent(Agent):
    """Injects dynamic interviewer context into the LLM before each turn."""

    def __init__(self, session_id: str, initial_instructions: str, **kwargs: Any) -> None:
        super().__init__(instructions=initial_instructions, **kwargs)
        self._session_id = session_id

    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[llm.Tool],
        model_settings: Any,
    ) -> Any:
        await _inject_llm_context(chat_ctx, self._session_id)
        return Agent.default.llm_node(self, chat_ctx, tools, model_settings)


async def _inject_llm_context(chat_ctx: Any, session_id: str) -> None:
    session_key = f"interview:{session_id}"
    session_data = await _get_session(session_key)
    if not session_data:
        return
    conductor = SessionConductor.load(session_data.get("session_conductor"))
    dynamic_ctx = conductor.build_llm_context()
    static_prompt = _build_system_prompt(session_data, conductor)
    combined = f"{static_prompt}\n\n{dynamic_ctx}"
    msgs = chat_ctx.messages()
    if not msgs:
        chat_ctx.add_message(role="system", content=combined)
        return
    first = msgs[0]
    first.role = "system"
    first.content = [combined]


async def _send_control(room: Any, message: Dict[str, Any]) -> None:
    try:
        payload = json.dumps(message).encode("utf-8")
        await room.local_participant.publish_data(payload, reliable=True, topic="control")
    except Exception as e:
        log.warning("Failed to send control message %s: %s", message.get("type"), e)


def _extract_question_text(q_entry: Any) -> str:
    if isinstance(q_entry, str):
        return q_entry
    if isinstance(q_entry, dict):
        q = q_entry.get("question") if "question" in q_entry else q_entry
        if isinstance(q, dict):
            return q.get("question") or q.get("title") or json.dumps(q)
        if isinstance(q, str):
            return q
    return str(q_entry)


def _get_dsa_inner(payload: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return None
    if payload.get("type") == "coding" and isinstance(payload.get("question"), dict):
        return payload["question"]
    if isinstance(payload.get("title"), str) and "test_cases" in payload:
        return payload
    return None


async def _handle_user_turn(
    session_id: str,
    transcript: str,
    interview_service: InterviewService,
    answer_started_at: list[float],
) -> None:
    session_key = f"interview:{session_id}"
    session_data = await _get_session(session_key)
    if not session_data:
        return
    conductor = SessionConductor.load(session_data.get("session_conductor"))
    answer_duration = max(0.0, time.monotonic() - answer_started_at[0])
    conductor.turn_count += 1
    conductor.append_turn("candidate", transcript)
    conductor.last_answer_duration = answer_duration

    questions = session_data.get("questions", []) or []
    current_idx = int(session_data.get("current_question_index", 0))
    question_entry = questions[current_idx] if 0 <= current_idx < len(questions) else {}
    question_text = _extract_question_text(question_entry)

    session_data["session_conductor"] = conductor.serialize()
    await _update_session(session_key, session_data)

    asyncio.create_task(
        _run_evaluation_async(
            session_id=session_id,
            transcript=transcript,
            question_text=question_text,
            answer_duration=answer_duration,
            conductor=conductor,
            session_data=session_data,
            interview_service=interview_service,
        )
    )


async def _run_evaluation_async(
    session_id: str,
    transcript: str,
    question_text: str,
    answer_duration: float,
    conductor: SessionConductor,
    session_data: Dict[str, Any],
    interview_service: InterviewService,
) -> None:
    try:
        evaluation = await interview_service.evaluate_answer(
            question_text, transcript, answer_duration, conductor.current_code
        )
        conductor.update_from_answer(transcript, evaluation)
        session_data["session_conductor"] = conductor.serialize()
        await _update_session(f"interview:{session_id}", session_data)
    except Exception as e:
        log.error("Background evaluation failed for %s: %s", session_id, e, exc_info=True)


async def _handle_agent_turn(session_id: str, text: str) -> None:
    clean = (text or "").strip()
    if not clean:
        return
    session_key = f"interview:{session_id}"
    session_data = await _get_session(session_key)
    if not session_data:
        return
    conductor = SessionConductor.load(session_data.get("session_conductor"))
    conductor.append_turn("interviewer", clean)
    session_data["session_conductor"] = conductor.serialize()
    await _update_session(session_key, session_data)


def _is_session_active(session: AgentSession) -> bool:
    """Return False when the session is no longer running, using defensive attribute access."""
    session_closed = getattr(session, "closed", None)
    if session_closed is True:
        return False
    session_running = getattr(session, "running", None)
    if session_running is False:
        return False
    if session_closed is None and session_running is None and getattr(session, "_activity", None) is None:
        # All public and fallback private signals are absent — treat as inactive (e.g. older SDK version).
        return False
    return True


_ENDED_STATUSES = frozenset({"ended_early", "completed", "incomplete_exit"})


async def _emit_session_status(ctx: JobContext, session_data: Dict[str, Any]) -> None:
    status = str(session_data.get("status") or "active")
    ended = status in _ENDED_STATUSES
    payload: Dict[str, Any] = {
        "type": "session_status",
        "status": "ended" if ended else "active",
        "completion_reason": session_data.get("completion_reason"),
    }
    final_feedback = session_data.get("final_feedback")
    if ended and final_feedback:
        if isinstance(final_feedback, dict):
            payload["final_feedback"] = final_feedback.get("feedback")
            payload["full"] = final_feedback
        else:
            payload["final_feedback"] = final_feedback
    await _send_control(ctx.room, SessionStatusEvent(**payload).model_dump(exclude_none=True))


async def _maybe_restore_stt(session_id: str, ctx: JobContext) -> None:
    session_key = f"interview:{session_id}"
    session_data = await _get_session(session_key)
    if not session_data or not session_data.get("stt_degraded"):
        return
    session_data["stt_degraded"] = False
    session_data["stt_unavailable"] = False
    if not session_data.get("candidate_away_since"):
        session_data["silence_paused"] = False
    await _update_session(session_key, session_data)
    await _send_control(ctx.room, {"type": "stt_restored"})


async def _silence_watchdog(
    session: AgentSession,
    session_id: str,
    ctx: JobContext,
    interview_service: InterviewService,
    last_user_speech_at: list[float],
) -> None:
    last_user_speech_at[0] = time.monotonic()
    tier = 0
    tier1 = int(getattr(settings, "silence_tier1_seconds", 60))
    tier2 = int(getattr(settings, "silence_tier2_seconds", 120))
    tier3 = int(getattr(settings, "silence_tier3_seconds", 180))
    away_max = int(getattr(settings, "candidate_away_max_seconds", 600))
    session_key = f"interview:{session_id}"

    while True:
        await asyncio.sleep(5)

        if not _is_session_active(session):
            return

        agent_speaking = (
            getattr(session, "agent_state", None) == "speaking"
            or getattr(session, "_agent_state", None) == "speaking"
        )
        if agent_speaking:
            continue

        session_data = await _get_session(session_key)
        if not session_data:
            continue
        if session_data.get("status") in _ENDED_STATUSES:
            return

        if session_data.get("silence_paused"):
            away_since = session_data.get("candidate_away_since")
            if away_since:
                away_for = time.time() - float(away_since)
                if away_for >= away_max:
                    try:
                        await _send_control(ctx.room, {
                            "type": "session_status",
                            "status": "active",
                            "away_seconds": int(away_for),
                        })
                        await session.say(
                            "You were away for a while; I'll close out the session and share your report."
                        )
                        await _handle_end_interview(
                            ctx,
                            session,
                            session_id,
                            interview_service,
                            completion_reason="tab_away_timeout",
                        )
                    except RuntimeError:
                        return
                    return
            continue

        if session_data.get("stt_unavailable"):
            continue

        conductor = SessionConductor.load(session_data.get("session_conductor"))
        if conductor.session_phase == "dsa" and conductor.last_code_change_at:
            if (time.time() - conductor.last_code_change_at) < 30:
                last_user_speech_at[0] = time.monotonic()
                tier = 0
                continue

        silence_for = time.monotonic() - last_user_speech_at[0]
        if silence_for < tier1:
            tier = 0
            continue
        try:
            if silence_for >= tier3 and tier < 3:
                tier = 3
                await _send_control(ctx.room, {
                    "type": "silence_warning",
                    "tier": 3,
                    "seconds_silent": int(silence_for),
                    "ending": True,
                })
                await session.say(
                    "I haven't heard anything for a while, so I'll wrap up here and share what we have so far."
                )
                await _handle_end_interview(
                    ctx, session, session_id, interview_service, completion_reason="silence_timeout"
                )
                return
            if silence_for >= tier2 and tier < 2:
                tier = 2
                await _send_control(ctx.room, {
                    "type": "silence_warning",
                    "tier": 2,
                    "seconds_silent": int(silence_for),
                })
                await session.say("Would you like me to rephrase the question?")
                continue
            if silence_for >= tier1 and tier < 1:
                tier = 1
                await _send_control(ctx.room, {
                    "type": "silence_warning",
                    "tier": 1,
                    "seconds_silent": int(silence_for),
                })
                await session.say("Take your time. I'm listening.")
        except RuntimeError:
            return


async def _duration_watchdog(
    session: AgentSession,
    session_id: str,
    ctx: JobContext,
    started_at: datetime,
    interview_service: InterviewService,
) -> None:
    warned = False
    max_minutes = int(getattr(settings, "max_interview_duration_minutes", 60))
    while True:
        await asyncio.sleep(60)

        if not _is_session_active(session):
            return

        elapsed_minutes = int((datetime.now(timezone.utc) - started_at).total_seconds() / 60)
        try:
            if max_minutes > 5 and not warned and elapsed_minutes >= (max_minutes - 5):
                warned = True
                await session.say("We have about five minutes left. Let's wrap up strong.")
            if elapsed_minutes >= max_minutes:
                log.info("Max duration reached for %s (%d min)", session_id, elapsed_minutes)
                await _handle_end_interview(
                    ctx, session, session_id, interview_service, completion_reason="max_duration"
                )
                return
        except RuntimeError:
            return


async def _handle_control_message(
    message: Dict[str, Any],
    session: AgentSession,
    session_id: str,
    ctx: JobContext,
    interview_service: InterviewService,
    last_user_speech_at: list[float],
) -> None:
    msg_type = message.get("type")
    session_key = f"interview:{session_id}"
    session_data = await _get_session(session_key)
    if not session_data:
        return
    conductor = SessionConductor.load(session_data.get("session_conductor"))

    if msg_type == "ping":
        await _send_control(ctx.room, {"type": "pong"})
        return
    if msg_type == "code_update":
        code = str(message.get("code") or "")[:CODE_PAYLOAD_MAX_LENGTH]
        language = str(message.get("language") or "python")
        conductor.update_code(code, language=language, changed_at=time.time())
        session_data["session_conductor"] = conductor.serialize()
        await _update_session(session_key, session_data)
        return
    if msg_type == "execution_result":
        conductor.update_execution(
            str(message.get("output") or ""), bool(message.get("has_errors"))
        )
        session_data["session_conductor"] = conductor.serialize()
        await _update_session(session_key, session_data)
        return
    if msg_type == "candidate_away":
        session_data["candidate_away_since"] = time.time()
        session_data["silence_paused"] = True
        await _update_session(session_key, session_data)
        return
    if msg_type == "candidate_back":
        session_data["silence_paused"] = False
        session_data.pop("candidate_away_since", None)
        last_user_speech_at[0] = time.monotonic()
        await _update_session(session_key, session_data)
        await _emit_session_status(ctx, session_data)
        return
    if msg_type == "end_interview":
        await _handle_end_interview(
            ctx, session, session_id, interview_service, completion_reason="user_ended"
        )
        return
    if msg_type in {"skip_question", "dsa_next_question"}:
        await _handle_skip_question(ctx, session, session_id, interview_service)
        return
    if msg_type == "text_answer":
        text = str(message.get("text") or "").strip()
        if text:
            await session.generate_reply(
                instructions=f"The candidate just said: {text}. Acknowledge and respond naturally."
            )


async def _handle_skip_question(
    ctx: JobContext,
    session: AgentSession,
    session_id: str,
    interview_service: InterviewService,
) -> None:
    session_key = f"interview:{session_id}"
    session_data = await _get_session(session_key)
    if not session_data:
        return

    questions = session_data.get("questions", []) or []
    current_q_index = int(session_data.get("current_question_index", 0))
    responses = session_data.get("responses", []) or []
    skipped = questions[current_q_index] if current_q_index < len(questions) else None
    if skipped:
        responses.append({
            "question_index": current_q_index,
            "question": skipped,
            "response": "[skipped by user]",
            "skipped": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    try:
        interview_type = InterviewType(session_data.get("interview_type", "dsa"))
    except Exception:
        interview_type = InterviewType.DSA
    try:
        difficulty = DifficultyLevel(session_data.get("difficulty", "medium"))
    except Exception:
        difficulty = DifficultyLevel.MEDIUM

    if interview_type == InterviewType.DSA:
        context = interview_service._build_context(
            InterviewType.DSA,
            session_data.get("resume_data"),
            session_data.get("custom_role"),
            session_data.get("years_experience"),
            target_context={
                "target_company": session_data.get("target_company"),
                "target_role": session_data.get("target_role"),
                "job_description": session_data.get("job_description"),
                "interview_focus": session_data.get("interview_focus"),
                "jd_fit_context": session_data.get("jd_fit_context"),
                "resume_probe_context": session_data.get("resume_probe_context"),
            },
        )
        next_question_raw = await interview_service._generate_dsa_question(difficulty, context)
        next_question_obj = {
            "question": next_question_raw,
            "type": "coding",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        questions.append(next_question_obj)
        session_data["questions"] = questions
        session_data["responses"] = responses
        session_data["current_question_index"] = current_q_index + 1
        session_data["last_updated"] = datetime.now(timezone.utc).isoformat()
        await _update_session(session_key, session_data)
        inner = _get_dsa_inner(next_question_obj) or next_question_obj
        await _send_control(ctx.room, {"type": "phase_change", "phase": "dsa"})
        await _send_control(ctx.room, {
            "type": "question",
            "question": inner,
            "phase": "dsa",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return

    context = interview_service._build_context(
        interview_type,
        session_data.get("resume_data"),
        session_data.get("custom_role"),
        session_data.get("years_experience"),
        target_context={
            "target_company": session_data.get("target_company"),
            "target_role": session_data.get("target_role"),
            "job_description": session_data.get("job_description"),
            "interview_focus": session_data.get("interview_focus"),
            "jd_fit_context": session_data.get("jd_fit_context"),
            "resume_probe_context": session_data.get("resume_probe_context"),
        },
    )
    follow_up_text = await interview_service.generate_follow_up(responses, interview_type, llm_context=context)
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
    await _update_session(session_key, session_data)
    await session.say(follow_up_text)


async def _handle_end_interview(
    ctx: JobContext,
    session: AgentSession,
    session_id: str,
    interview_service: InterviewService,
    completion_reason: str = "ended_early",
) -> None:
    session_key = f"interview:{session_id}"
    session_data = await _get_session(session_key)
    if not session_data:
        return
    if session_data.get("status") in {"ended_early", "completed", "incomplete_exit"}:
        return

    if hasattr(session, "update_options"):
        try:
            await session.update_options(allow_interruptions=False)  # type: ignore[call-arg]
        except Exception:
            pass

    feedback_lock_key = f"feedback_generating:{session_id}"
    try:
        redis = await _ensure_redis()
        acquired = await redis.set(feedback_lock_key, "1", nx=True, ex=120)
    except Exception:
        acquired = False
    if not acquired:
        return

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
    attach_transcript_to_session(session_data)
    feedback_payload = {
        "interview_type": session_data.get("interview_type"),
        "custom_role": session_data.get("custom_role"),
        "target_company": session_data.get("target_company"),
        "target_role": session_data.get("target_role"),
        "job_description": session_data.get("job_description"),
        "interview_focus": session_data.get("interview_focus"),
        "jd_fit_context": session_data.get("jd_fit_context"),
        "resume_probe_context": session_data.get("resume_probe_context"),
        "completion_reason": completion_reason,
        "duration": duration_minutes,
        "responses": session_data.get("responses", []),
        "code_submissions": session_data.get("code_submissions", []),
        "live_transcription": session_data.get("live_transcription", []),
        "session_conductor": session_data.get("session_conductor"),
    }
    final_feedback = await interview_service.generate_final_feedback(feedback_payload)
    scores = parse_scores_from_feedback(
        final_feedback.get("feedback") if isinstance(final_feedback, dict) else None
    )

    completed_ts = datetime.now(timezone.utc).isoformat()
    if completion_reason == "silence_timeout":
        end_event = SessionEventType.SILENCE_TIMEOUT
    elif completion_reason == "tab_away_timeout":
        end_event = SessionEventType.TAB_AWAY_TIMEOUT
    elif completion_reason == "max_duration":
        end_event = SessionEventType.MAX_DURATION
    elif completion_reason in {"error", "candidate_disconnected"}:
        end_event = SessionEventType.ERROR_END
    else:
        end_event = SessionEventType.MANUAL_END
    terminal_state = SessionStateMachine.transition(
        session_data.get("status", "active"),
        SessionEvent(type=end_event, reason=completion_reason),
    ).value
    session_data.update({
        "status": terminal_state,
        "completion_reason": completion_reason,
        "completed_at": completed_ts,
        "last_updated": completed_ts,
        "final_feedback": final_feedback,
        "duration_minutes": duration_minutes,
        "questions_answered": len(session_data.get("responses", [])),
        "code_problems_attempted": len(session_data.get("code_submissions", [])),
        "live_transcription": session_data.get("live_transcription", []),
    })
    await _update_session(session_key, session_data)

    try:
        db.collection("interviews").document(session_id).set({
            "status": terminal_state,
            "completion_reason": completion_reason,
            "completed_at": firestore.SERVER_TIMESTAMP,
            "last_updated": firestore.SERVER_TIMESTAMP,
            "duration_minutes": duration_minutes,
            "questions_answered": session_data["questions_answered"],
            "code_problems_attempted": session_data["code_problems_attempted"],
            "responses": session_data.get("responses", []),
            "questions": session_data.get("questions", []),
            "code_submissions": session_data.get("code_submissions", []),
            "live_transcription": session_data.get("live_transcription", []),
            "final_feedback": final_feedback,
            "scores": scores,
        }, merge=True)
    except Exception as e:
        log.warning("Firestore persist failed: %s", e)

    await _send_control(ctx.room, InterviewEndedEvent(
        completion_reason=completion_reason,
        duration_minutes=duration_minutes,
        questions_answered=session_data["questions_answered"],
        timestamp=completed_ts,
    ).model_dump())
    await _send_control(ctx.room, {
        "type": "feedback",
        "feedback": final_feedback.get("feedback") if isinstance(final_feedback, dict) else final_feedback,
        "full": final_feedback,
        "duration_minutes": duration_minutes,
        "questions_answered": session_data["questions_answered"],
        "code_problems_attempted": session_data["code_problems_attempted"],
        "status": terminal_state,
        "completion_reason": completion_reason,
        "timestamp": completed_ts,
    })
    await _send_control(ctx.room, {"type": "status", "status": "completed"})


async def _handle_candidate_disconnect(
    ctx: JobContext,
    session: AgentSession,
    session_id: str,
    interview_service: InterviewService,
) -> None:
    await asyncio.sleep(90)
    session_key = f"interview:{session_id}"
    session_data = await _get_session(session_key)
    if not session_data:
        return

    if session_data.get("status") in {"ended_early", "completed", "incomplete_exit"}:
        return

    session_data["status"] = SessionStateMachine.transition(
        session_data.get("status", "active"),
        SessionEvent(type=SessionEventType.DISCONNECT_TIMEOUT, reason="candidate_disconnected"),
    ).value
    session_data["completion_reason"] = "candidate_disconnected"
    completed_ts = datetime.now(timezone.utc).isoformat()
    session_data["completed_at"] = completed_ts
    session_data["last_updated"] = completed_ts
    attach_transcript_to_session(session_data)

    responses = session_data.get("responses", []) or []
    if len(responses) >= 2:
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
                "target_company": session_data.get("target_company"),
                "target_role": session_data.get("target_role"),
                "job_description": session_data.get("job_description"),
                "interview_focus": session_data.get("interview_focus"),
                "jd_fit_context": session_data.get("jd_fit_context"),
                "resume_probe_context": session_data.get("resume_probe_context"),
                "duration": duration_minutes,
                "responses": responses,
                "code_submissions": session_data.get("code_submissions", []),
                "live_transcription": session_data.get("live_transcription", []),
                "session_conductor": session_data.get("session_conductor"),
            }
            final_feedback = await asyncio.wait_for(
                interview_service.generate_final_feedback(feedback_payload), 45.0
            )
            session_data["final_feedback"] = final_feedback
        except (asyncio.TimeoutError, Exception) as e:
            log.warning("Partial feedback generation failed: %s", e)

    session_data["questions_answered"] = len(responses)
    session_data["code_problems_attempted"] = len(session_data.get("code_submissions", []))
    await _update_session(session_key, session_data)

    try:
        scores = parse_scores_from_feedback(
            session_data.get("final_feedback", {}).get("feedback")
            if isinstance(session_data.get("final_feedback"), dict) else None
        )
        db.collection("interviews").document(session_id).set({
            "status": "incomplete_exit",
            "completion_reason": "candidate_disconnected",
            "completed_at": firestore.SERVER_TIMESTAMP,
            "last_updated": firestore.SERVER_TIMESTAMP,
            "questions_answered": session_data["questions_answered"],
            "code_problems_attempted": session_data["code_problems_attempted"],
            "responses": session_data.get("responses", []),
            "questions": session_data.get("questions", []),
            "code_submissions": session_data.get("code_submissions", []),
            "live_transcription": session_data.get("live_transcription", []),
            "final_feedback": session_data.get("final_feedback"),
            "scores": scores,
        }, merge=True)
    except Exception as e:
        log.warning("Firestore persist on disconnect failed: %s", e)


@server.rtc_session(agent_name=settings.livekit_agent_name or "vetta-interviewer")
async def entrypoint(ctx: JobContext) -> None:
    """Main agent entrypoint — called once per room by the AgentServer."""
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session_id = ctx.room.name
    log.info("Agent entrypoint fired for room: %s", session_id)

    session_key = f"interview:{session_id}"
    session_data = await _get_session(session_key)
    if not session_data:
        log.warning("No session data found for room %s — agent exiting", session_id)
        return

    interview_service = InterviewService()
    conductor = SessionConductor.load(session_data.get("session_conductor"))
    started_at = datetime.now(timezone.utc)
    answer_started_at = [time.monotonic()]
    last_user_speech_at = [time.monotonic()]

    groq_llm = groq.LLM(
        model=settings.groq_model or "llama-3.3-70b-versatile",
        api_key=settings.groq_api_key,
    )

    from services.interview.agent_tts_plugin import EdgeTTSPlugin

    tts_plugin = EdgeTTSPlugin(
        voice=getattr(settings, "edge_tts_voice", "en-US-JennyNeural"),
        rate=getattr(settings, "edge_tts_rate", "+0%"),
        pitch=getattr(settings, "edge_tts_pitch", "+0Hz"),
    )

    vad = ctx.proc.userdata.get("vad") or silero.VAD.load()

    initial_instructions = _build_system_prompt(session_data, conductor)
    agent = InterviewerAgent(session_id=session_id, initial_instructions=initial_instructions)

    session = AgentSession(
        vad=vad,
        stt=deepgram.STT(
            api_key=settings.deepgram_api_key,
            model=settings.deepgram_model,
            language="en-US",
            interim_results=True,
            endpointing_ms=getattr(settings, "deepgram_endpointing_ms", 300),
        ),
        llm=groq_llm,
        tts=tts_plugin,
        allow_interruptions=True,
    )

    disconnect_task: Optional[asyncio.Task] = None
    error_state = {"count": 0, "last_at": 0.0, "ending": False}

    def _on_user_state_changed(ev: Any) -> None:
        if getattr(ev, "new_state", None) == "speaking":
            answer_started_at[0] = time.monotonic()
            last_user_speech_at[0] = time.monotonic()
            asyncio.create_task(_send_control(ctx.room, {"type": "status", "status": "listening"}))

    def _on_user_input_transcribed(ev: Any) -> None:
        is_final = getattr(ev, "is_final", True)
        # livekit-agents may use different attribute names across versions
        transcript = (
            getattr(ev, "transcript", None)
            or getattr(ev, "content", None)
            or getattr(ev, "text", "")
            or ""
        )
        transcript = str(transcript).strip()

        # Forward both interim and final transcripts so the UI can show live captions
        if transcript:
            asyncio.create_task(_send_control(ctx.room, {
                "type": "transcript",
                "text": transcript,
                "is_final": is_final,
            }))

        if is_final and len(transcript) >= 3:
            last_user_speech_at[0] = time.monotonic()
            asyncio.create_task(_maybe_restore_stt(session_id, ctx))

        if not is_final:
            return

        asyncio.create_task(_send_control(ctx.room, {"type": "interviewer_thinking"}))
        asyncio.create_task(
            _handle_user_turn(
                session_id=session_id,
                transcript=transcript,
                interview_service=interview_service,
                answer_started_at=answer_started_at,
            )
        )

    def _on_agent_state_changed(ev: Any) -> None:
        new_state = getattr(ev, "new_state", None)
        if new_state == "speaking":
            asyncio.create_task(_send_control(ctx.room, {"type": "audio_started"}))
            asyncio.create_task(_send_control(ctx.room, {"type": "status", "status": "speaking"}))
        elif new_state == "listening":
            last_user_speech_at[0] = time.monotonic()
            asyncio.create_task(_send_control(ctx.room, {"type": "audio_ended"}))
            asyncio.create_task(_send_control(ctx.room, {"type": "status", "status": "listening"}))

    def _on_conversation_item_added(ev: Any) -> None:
        item = getattr(ev, "item", None)
        text = extract_assistant_transcript_text(item)
        if not text:
            return
        asyncio.create_task(_send_control(ctx.room, {
            "type": "ai_transcript",
            "text": text,
        }))
        asyncio.create_task(_handle_agent_turn(session_id, text))

    def _on_error(ev: Any) -> None:
        err = getattr(ev, "error", ev) if hasattr(ev, "error") else ev
        log.error("Agent session error: %s", err, exc_info=False)
        if error_state["ending"]:
            return

        now = time.monotonic()
        # Reset rolling count if the last error was not recent.
        if now - float(error_state["last_at"]) > 30.0:
            error_state["count"] = 0
        error_state["last_at"] = now
        error_state["count"] = int(error_state["count"]) + 1

        err_text = str(err or "").lower()
        is_stt_error = any(
            marker in err_text
            for marker in ("stt", "deepgram", "net0001", "speech", "transcri")
        )
        likely_llm_provider_failure = (
            "rate limit" in err_text
            or "429" in err_text
            or "apiconnectionerror" in err_text
            or "failed to generate llm completion" in err_text
        )

        if is_stt_error and not likely_llm_provider_failure:

            async def _handle_stt_error() -> None:
                sd = await _get_session(f"interview:{session_id}")
                if not sd:
                    return
                sd["stt_degraded"] = True
                sd["silence_paused"] = True
                attempt = int(error_state["count"])
                await _update_session(f"interview:{session_id}", sd)
                await _send_control(
                    ctx.room, {"type": "reconnecting_stt", "attempt": attempt}
                )
                if attempt >= 2:
                    sd = await _get_session(f"interview:{session_id}") or sd
                    sd["stt_unavailable"] = True
                    await _update_session(f"interview:{session_id}", sd)
                    await _send_control(ctx.room, {"type": "stt_unavailable"})

            asyncio.create_task(_handle_stt_error())
            return

        async def _graceful_end_after_error() -> None:
            try:
                await _send_control(ctx.room, {"type": "status", "status": "thinking"})
                await session.say(
                    "I'm running into a temporary service issue, so I'll end the interview here and share your feedback collected so far. Thank you for your time."
                )
            except Exception:
                pass
            try:
                await _handle_end_interview(
                    ctx, session, session_id, interview_service, completion_reason="error"
                )
            except Exception:
                pass

        def _log_say_error(t: asyncio.Task) -> None:
            if not t.cancelled() and t.exception():
                log.warning("Error in recovery say: %s", t.exception())

        try:
            if likely_llm_provider_failure or int(error_state["count"]) >= 2:
                error_state["ending"] = True
                asyncio.create_task(_graceful_end_after_error())
                return
            asyncio.create_task(session.say("I had a small hiccup. Could you repeat that?")).add_done_callback(_log_say_error)
        except Exception:
            pass

    def _on_data_received(packet: Any) -> None:
        data = getattr(packet, "data", packet)
        try:
            payload = json.loads(
                data.decode("utf-8") if isinstance(data, (bytes, bytearray)) else str(data)
            )
        except Exception:
            return
        asyncio.create_task(
            _handle_control_message(
                payload, session, session_id, ctx, interview_service, last_user_speech_at
            )
        )

    def _on_participant_disconnected(participant: Any) -> None:
        nonlocal disconnect_task
        if str(getattr(participant, "identity", "")) != str(session_data.get("user_id")):
            return
        disconnect_task = asyncio.create_task(
            _handle_candidate_disconnect(ctx, session, session_id, interview_service)
        )

    def _on_participant_connected(participant: Any) -> None:
        nonlocal disconnect_task
        if str(getattr(participant, "identity", "")) != str(session_data.get("user_id")):
            return
        if disconnect_task and not disconnect_task.done():
            disconnect_task.cancel()
        asyncio.create_task(session.say("Welcome back. Ready to continue where we left off?"))

    session.on("user_state_changed", _on_user_state_changed)
    session.on("user_input_transcribed", _on_user_input_transcribed)
    session.on("agent_state_changed", _on_agent_state_changed)
    session.on("conversation_item_added", _on_conversation_item_added)
    session.on("error", _on_error)

    ctx.room.on("data_received", _on_data_received)
    ctx.room.on("participant_disconnected", _on_participant_disconnected)
    ctx.room.on("participant_connected", _on_participant_connected)

    log.info("Starting AgentSession for %s", session_id)
    await session.start(room=ctx.room, agent=agent)

    asyncio.create_task(_silence_watchdog(session, session_id, ctx, interview_service, last_user_speech_at))
    asyncio.create_task(_duration_watchdog(session, session_id, ctx, started_at, interview_service))

    # Greet the candidate
    if str(session_data.get("interview_type", "")).lower() == "dsa":
        first_question = (session_data.get("questions") or [{}])[0]
        inner = _get_dsa_inner(first_question) or first_question
        await _send_control(ctx.room, {"type": "phase_change", "phase": "dsa"})
        await _send_control(ctx.room, {
            "type": "question",
            "question": inner,
            "phase": "dsa",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await session.say("Let's start with this coding problem. Walk me through your approach.")
    else:
        candidate_name = (
            session_data.get("candidate_name")
            or _extract_resume_name(session_data.get("resume_data"))
            or "Candidate"
        )
        role = session_data.get("target_role") or session_data.get("custom_role") or session_data.get("interview_type", "technical")
        greeting = await interview_service.generate_greeting(candidate_name, role)
        await session.say(greeting)
        if str(session_data.get("interview_type", "")).lower() == "resume":
            first_question = (session_data.get("questions") or [{}])[0]
            first_question_text = _extract_question_text(first_question)
            if first_question_text and first_question_text != "{}":
                await session.say(first_question_text)

    log.info("Greeting delivered for session %s — agent is live", session_id)
