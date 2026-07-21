"""LiveKit Agents entrypoint for the Vetta.ai AI Interviewer.

AgentServer registers with LiveKit Cloud and dispatches an AgentSession per room.
Room name equals session_id; session data must exist in Redis before the user joins.
Pipeline: Deepgram STT → Groq LLM → Edge TTS (via EdgeTTSPlugin) → Silero VAD.
"""
import sys
from pathlib import Path

# Allow `python services/interview/agent.py dev` from backend/ (cwd on sys.path).
_backend_root = Path(__file__).resolve().parents[2]
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

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
from services.interview.contracts.session_events import (
    InterviewEndedEvent,
    SessionEvent,
    SessionEventType,
    SessionStateMachine,
    SessionStatusEvent,
)
from services.profile_memory.profile_claims_service import run_profile_claims_pipeline
from services.interview.interview_service import InterviewService
from services.interview.completion_guard import try_begin_completion
from services.interview.session_conductor import SessionConductor
from services.interview.transcript_service import attach_transcript_to_session, extract_assistant_transcript_text
from utils.feedback_parser import parse_scores_from_feedback
from services.interview.modes.registry import is_coding_interview_type
from utils.logger import get_logger
from services.interview.session_store import SessionStore, deep_merge_session_conductor
from utils.session_errors import SessionConflictError
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
_session_locks: Dict[str, asyncio.Lock] = {}


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


async def _session_store(session_key: str, ttl: int = SESSION_TTL) -> SessionStore:
    return SessionStore(session_key, redis_client=await _ensure_redis(), ttl=ttl)


async def _get_session(session_key: str) -> Optional[Dict[str, Any]]:
    try:
        return await (await _session_store(session_key)).get()
    except Exception as e:
        log.error("Error retrieving session %s: %s", session_key, e, exc_info=True)
        return None


def _session_id_from_key(session_key: str) -> str:
    return session_key.removeprefix("interview:")


def _session_lock(session_id: str) -> asyncio.Lock:
    lock = _session_locks.get(session_id)
    if lock is None:
        lock = asyncio.Lock()
        _session_locks[session_id] = lock
    return lock


async def _mutate_session(
    session_key: str,
    mutator,
    ttl: int = SESSION_TTL,
    *,
    max_attempts: int = 4,
) -> Optional[Dict[str, Any]]:
    session_id = _session_id_from_key(session_key)
    async with _session_lock(session_id):
        store = await _session_store(session_key, ttl=ttl)
        last_exc: Optional[Exception] = None
        for attempt in range(max_attempts):
            try:
                return await store.update(mutator)
            except SessionConflictError as exc:
                last_exc = exc
                if attempt + 1 >= max_attempts:
                    raise
                await asyncio.sleep(0.05 * (attempt + 1))
        if last_exc:
            raise last_exc
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
    merge_gap_ms = int(getattr(settings, "transcript_merge_gap_ms", 1500))
    merge_max_chars = int(getattr(settings, "transcript_merge_max_chars", 1200))
    answer_duration = max(0.0, time.monotonic() - answer_started_at[0])
    conductor.turn_count += 1
    conductor.append_or_merge_turn(
        "candidate",
        transcript,
        timestamp=time.time(),
        gap_ms=merge_gap_ms,
        max_chars=merge_max_chars,
    )
    conductor.last_answer_duration = answer_duration

    questions = session_data.get("questions", []) or []
    current_idx = int(session_data.get("current_question_index", 0))
    question_entry = questions[current_idx] if 0 <= current_idx < len(questions) else {}
    question_text = _extract_question_text(question_entry)

    serialized = conductor.serialize()

    def _apply_turn(current: Dict[str, Any]) -> Dict[str, Any]:
        base = dict(current) if isinstance(current, dict) else {}
        return deep_merge_session_conductor(
            base,
            {"session_conductor": serialized},
        )

    await _mutate_session(session_key, _apply_turn)

    asyncio.create_task(
        _run_evaluation_async(
            session_id=session_id,
            transcript=transcript,
            question_text=question_text,
            answer_duration=answer_duration,
            interview_service=interview_service,
        )
    )


async def _run_evaluation_async(
    session_id: str,
    transcript: str,
    question_text: str,
    answer_duration: float,
    interview_service: InterviewService,
) -> None:
    session_key = f"interview:{session_id}"
    try:
        snapshot = await _get_session(session_key) or {}
        conductor = SessionConductor.load(snapshot.get("session_conductor"))
        evaluation = await interview_service.evaluate_answer(
            question_text, transcript, answer_duration, conductor.current_code
        )
        conductor.update_from_answer(transcript, evaluation)
        serialized = conductor.serialize()

        def _apply_eval(current: Dict[str, Any]) -> Dict[str, Any]:
            base = dict(current) if isinstance(current, dict) else {}
            return deep_merge_session_conductor(
                base,
                {"session_conductor": serialized},
            )

        await _mutate_session(session_key, _apply_eval)
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
    merge_gap_ms = int(getattr(settings, "transcript_merge_gap_ms", 1500))
    merge_max_chars = int(getattr(settings, "transcript_merge_max_chars", 1200))
    conductor.append_or_merge_turn(
        "interviewer",
        clean,
        timestamp=time.time(),
        gap_ms=merge_gap_ms,
        max_chars=merge_max_chars,
    )
    serialized = conductor.serialize()

    def _apply_agent_turn(current: Dict[str, Any]) -> Dict[str, Any]:
        base = dict(current) if isinstance(current, dict) else {}
        return deep_merge_session_conductor(
            base,
            {"session_conductor": serialized},
        )

    await _mutate_session(session_key, _apply_agent_turn)


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

    patch = {
        "stt_degraded": False,
        "stt_unavailable": False,
    }
    if not session_data.get("candidate_away_since"):
        patch["silence_paused"] = False

    await _mutate_session(
        session_key,
        lambda current: deep_merge_session_conductor(current, patch),
    )
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
        if conductor.session_phase in {"dsa", "coding"} and conductor.last_code_change_at:
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

    if msg_type == "ping":
        await _send_control(ctx.room, {"type": "pong"})
        return
    if msg_type == "code_update":
        if not is_coding_interview_type(session_data.get("interview_type")):
            log.debug("Ignoring code_update on non-coding session %s", session_id)
            return
        code = str(message.get("code") or "")[:CODE_PAYLOAD_MAX_LENGTH]
        language = str(message.get("language") or "python")
        changed_at = time.time()

        def _patch_code(current: Dict[str, Any]) -> Dict[str, Any]:
            base = dict(current) if isinstance(current, dict) else {}
            conductor = SessionConductor.load(base.get("session_conductor"))
            conductor.update_code(code, language=language, changed_at=changed_at)
            base["session_conductor"] = conductor.serialize()
            return base

        await _mutate_session(session_key, _patch_code)
        return
    if msg_type == "execution_result":
        if not is_coding_interview_type(session_data.get("interview_type")):
            log.debug("Ignoring execution_result on non-coding session %s", session_id)
            return
        output = str(message.get("output") or "")
        has_errors = bool(message.get("has_errors"))

        def _patch_execution(current: Dict[str, Any]) -> Dict[str, Any]:
            base = dict(current) if isinstance(current, dict) else {}
            conductor = SessionConductor.load(base.get("session_conductor"))
            conductor.update_execution(output, has_errors)
            base["session_conductor"] = conductor.serialize()
            return base

        await _mutate_session(session_key, _patch_execution)
        return
    if msg_type == "candidate_away":

        def _patch_away(current: Dict[str, Any]) -> Dict[str, Any]:
            base = dict(current) if isinstance(current, dict) else {}
            base["candidate_away_since"] = time.time()
            base["silence_paused"] = True
            return base

        await _mutate_session(session_key, _patch_away)
        return
    if msg_type == "candidate_back":

        def _patch_back(current: Dict[str, Any]) -> Dict[str, Any]:
            base = dict(current) if isinstance(current, dict) else {}
            base["silence_paused"] = False
            base.pop("candidate_away_since", None)
            return base

        await _mutate_session(session_key, _patch_back)
        last_user_speech_at[0] = time.monotonic()
        refreshed = await _get_session(session_key)
        if refreshed:
            await _emit_session_status(ctx, refreshed)
        return
    if msg_type == "end_interview":
        await _handle_end_interview(
            ctx, session, session_id, interview_service, completion_reason="user_ended"
        )
        return
    if msg_type in {"skip_question", "dsa_next_question", "coding_next_question"}:
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
        interview_type = InterviewType(session_data.get("interview_type", "role_targeted"))
    except Exception:
        interview_type = InterviewType.ROLE_TARGETED
    try:
        difficulty = DifficultyLevel(session_data.get("difficulty", "medium"))
    except Exception:
        difficulty = DifficultyLevel.MEDIUM

    if is_coding_interview_type(interview_type):
        track = str(session_data.get("track") or "dsa").strip().lower() or "dsa"
        focus = (session_data.get("session_focus") or "").strip()
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
                "session_focus": focus or None,
                "track": track,
                "jd_fit_context": session_data.get("jd_fit_context"),
                "resume_probe_context": session_data.get("resume_probe_context"),
            },
        )
        if focus:
            context = f"{context}\nSession focus topics: {focus}"
        next_question_raw = await interview_service.generate_coding_question(
            track=track,
            difficulty=difficulty,
            context=context,
        )
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

        def _apply_coding_skip(current: Dict[str, Any]) -> Dict[str, Any]:
            base = dict(current) if isinstance(current, dict) else {}
            base.update({
                "questions": questions,
                "responses": responses,
                "current_question_index": current_q_index + 1,
                "last_updated": session_data["last_updated"],
            })
            return base

        await _mutate_session(session_key, _apply_coding_skip)
        inner = _get_dsa_inner(next_question_obj) or next_question_obj
        # ponytail: also emit "dsa" alias until older clients drain — primary is "coding"
        await _send_control(ctx.room, {"type": "phase_change", "phase": "coding"})
        await _send_control(ctx.room, {
            "type": "question",
            "question": inner,
            "phase": "coding",
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

    def _apply_skip(current: Dict[str, Any]) -> Dict[str, Any]:
        base = dict(current) if isinstance(current, dict) else {}
        base.update({
            "questions": questions,
            "responses": responses,
            "current_question_index": current_q_index + 1,
            "last_updated": session_data["last_updated"],
        })
        return base

    await _mutate_session(session_key, _apply_skip)
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

    worker_redis = await _ensure_redis()
    begin = await try_begin_completion(session_id, session_data, redis_client=worker_redis)
    if not begin.proceed:
        return

    session_data = dict(begin.session_data or session_data)

    if hasattr(session, "update_options"):
        try:
            await session.update_options(allow_interruptions=False)  # type: ignore[call-arg]
        except Exception:
            pass

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
    terminal_patch = {
        "status": terminal_state,
        "completion_reason": completion_reason,
        "completed_at": completed_ts,
        "last_updated": completed_ts,
        "final_feedback": final_feedback,
        "duration_minutes": duration_minutes,
        "questions_answered": len(session_data.get("responses", [])),
        "code_problems_attempted": len(session_data.get("code_submissions", [])),
        "live_transcription": session_data.get("live_transcription", []),
    }

    def _apply_terminal(current: Dict[str, Any]) -> Dict[str, Any]:
        base = dict(current) if isinstance(current, dict) else {}
        base.update(terminal_patch)
        return base

    updated = await _mutate_session(session_key, _apply_terminal) or terminal_patch
    session_data.update(updated)

    async def _run_vpm_task() -> None:
        if not get_settings().vpm_enabled:
            return
        try:
            result = await run_profile_claims_pipeline(
                uid=str(session_data.get("user_id") or ""),
                session_id=session_id,
                session_data=session_data,
                engine=interview_service._engine,  # noqa: SLF001
            )
            if result.get("failed") or result.get("pipeline_status") == "failed":
                log.warning(
                    "Agent VPM pipeline failed session=%s reason=%s",
                    session_id,
                    result.get("reason"),
                )
        except Exception as vpm_error:
            log.warning("Agent VPM pipeline failed: %s", vpm_error)

    asyncio.create_task(_run_vpm_task())

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

    worker_redis = await _ensure_redis()
    begin = await try_begin_completion(session_id, session_data, redis_client=worker_redis)
    if not begin.proceed:
        return

    session_data = dict(begin.session_data or session_data)
    completed_ts = datetime.now(timezone.utc).isoformat()
    attach_transcript_to_session(session_data)

    responses = session_data.get("responses", []) or []
    final_feedback = session_data.get("final_feedback")
    if len(responses) >= 2 and not final_feedback:
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
        except (asyncio.TimeoutError, Exception) as e:
            log.warning("Partial feedback generation failed: %s", e)
            final_feedback = None

    terminal_state = SessionStateMachine.transition(
        session_data.get("status", "active"),
        SessionEvent(type=SessionEventType.DISCONNECT_TIMEOUT, reason="candidate_disconnected"),
    ).value
    disconnect_patch = {
        "status": terminal_state,
        "completion_reason": "candidate_disconnected",
        "completed_at": completed_ts,
        "last_updated": completed_ts,
        "questions_answered": len(responses),
        "code_problems_attempted": len(session_data.get("code_submissions", [])),
    }
    if final_feedback is not None:
        disconnect_patch["final_feedback"] = final_feedback

    def _apply_disconnect(current: Dict[str, Any]) -> Dict[str, Any]:
        base = dict(current) if isinstance(current, dict) else {}
        base.update(disconnect_patch)
        return base

    updated = await _mutate_session(session_key, _apply_disconnect) or disconnect_patch
    session_data.update(updated)

    async def _run_vpm_task() -> None:
        if not get_settings().vpm_enabled:
            return
        try:
            result = await run_profile_claims_pipeline(
                uid=str(session_data.get("user_id") or ""),
                session_id=session_id,
                session_data=session_data,
                engine=interview_service._engine,  # noqa: SLF001
            )
            if result.get("failed") or result.get("pipeline_status") == "failed":
                log.warning(
                    "Disconnect VPM pipeline failed session=%s reason=%s",
                    session_id,
                    result.get("reason"),
                )
        except Exception as vpm_error:
            log.warning("Disconnect VPM pipeline failed: %s", vpm_error)

    asyncio.create_task(_run_vpm_task())

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
                attempt = int(error_state["count"])
                session_key = f"interview:{session_id}"

                def _mark_degraded(current: Dict[str, Any]) -> Dict[str, Any]:
                    base = dict(current) if isinstance(current, dict) else {}
                    if not base:
                        return base
                    base["stt_degraded"] = True
                    base["silence_paused"] = True
                    return base

                updated = await _mutate_session(session_key, _mark_degraded)
                if not updated:
                    return
                await _send_control(
                    ctx.room, {"type": "reconnecting_stt", "attempt": attempt}
                )
                if attempt >= 2:
                    def _mark_unavailable(current: Dict[str, Any]) -> Dict[str, Any]:
                        base = dict(current) if isinstance(current, dict) else {}
                        if not base:
                            return base
                        base["stt_unavailable"] = True
                        return base

                    await _mutate_session(session_key, _mark_unavailable)
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
    if is_coding_interview_type(session_data.get("interview_type")):
        first_question = (session_data.get("questions") or [{}])[0]
        inner = _get_dsa_inner(first_question) or first_question
        await _send_control(ctx.room, {"type": "phase_change", "phase": "coding"})
        await _send_control(ctx.room, {
            "type": "question",
            "question": inner,
            "phase": "coding",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await session.say(
            "I'll pair with you on this coding problem. Talk through your approach, "
            "then we'll implement and refine together."
        )
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


if __name__ == "__main__":
    from livekit.agents import cli

    cli.run_app(server)
