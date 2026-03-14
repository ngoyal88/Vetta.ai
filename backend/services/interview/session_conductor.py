import random
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from utils.logger import get_logger

logger = get_logger("SessionConductor")

VALID_PHASES = frozenset({
    "greeting", "behavioral", "technical", "dsa", "wrap_up", "feedback", "ended",
})


BACKCHANNELS = {
    "neutral": [
        ("Right.", 0.35),
        ("Okay.", 0.28),
        ("Got it.", 0.45),
        ("Sure.", 0.25),
        ("Mm-hmm.", 0.42),
        ("Alright.", 0.38),
    ],
    "positive": [
        ("Nice.", 0.22),
        ("Good instinct.", 0.55),
        ("That tracks.", 0.48),
        ("Yeah, solid.", 0.5),
    ],
    "probe": [
        ("Interesting.", 0.52),
        ("Hmm, okay.", 0.48),
        ("Tell me more.", 0.6),
    ],
    "silence": [
        ("", 0.0),
        ("", 0.0),
    ],
}


def _now() -> float:
    return time.time()


@dataclass
class SessionConductor:
    transcript_history: List[Dict[str, Any]] = field(default_factory=list)
    latest_interim_transcript: str = ""
    current_answer_parts: List[str] = field(default_factory=list)

    current_code: str = ""
    previous_code: str = ""
    current_language: str = "python"
    last_execution_output: Optional[str] = None
    code_has_errors: bool = False
    last_code_change_at: float = 0.0

    turn_count: int = 0
    session_phase: str = "greeting"
    session_start_time: float = field(default_factory=_now)
    recent_backchannels: List[str] = field(default_factory=list)

    pause_before_last_response: float = 0.0
    last_answer_duration: float = 0.0
    consecutive_weak_turns: int = 0
    consecutive_strong_turns: int = 0
    hedge_count_this_session: int = 0

    last_quality: Optional[str] = None
    last_confidence_signal: Optional[str] = None
    last_recommended_action: Optional[str] = None
    last_detected_misconception: Optional[str] = None

    def append_turn(self, role: str, text: str, timestamp: Optional[float] = None) -> None:
        clean = (text or "").strip()
        if not clean:
            return
        self.transcript_history.append(
            {
                "role": role,
                "text": clean,
                "timestamp": timestamp or _now(),
            }
        )

    def update_code(self, code: str, language: Optional[str] = None, changed_at: Optional[float] = None) -> None:
        self.previous_code = self.current_code
        self.current_code = code or ""
        if language:
            self.current_language = language
        self.last_code_change_at = changed_at or _now()

    def update_execution(self, output: Optional[str], has_errors: bool) -> None:
        self.last_execution_output = output or ""
        self.code_has_errors = bool(has_errors)

    def update_from_answer(self, transcript: str, evaluation: Optional[Dict[str, Any]] = None) -> None:
        clean = (transcript or "").strip()
        if clean:
            hedge_markers = ("maybe", "i think", "kind of", "sort of", "probably", "i guess")
            lowered = clean.lower()
            self.hedge_count_this_session += sum(lowered.count(marker) for marker in hedge_markers)

        evaluation = evaluation or {}
        quality = (evaluation.get("quality") or "").lower() or None
        confidence_signal = (evaluation.get("confidence_signal") or "").lower() or None
        recommended_action = (evaluation.get("recommended_action") or "").upper() or None
        misconception = evaluation.get("detected_misconception") or None

        self.last_quality = quality
        self.last_confidence_signal = confidence_signal
        self.last_recommended_action = recommended_action
        self.last_detected_misconception = misconception

        if quality in {"strong"} or confidence_signal == "high":
            self.consecutive_strong_turns += 1
            self.consecutive_weak_turns = 0
        elif quality in {"weak", "confused", "no_answer"} or confidence_signal == "low":
            self.consecutive_weak_turns += 1
            self.consecutive_strong_turns = 0
        else:
            self.consecutive_strong_turns = 0
            self.consecutive_weak_turns = 0

    def decide_next_action(self) -> str:
        if self.last_recommended_action:
            return self.last_recommended_action.upper()
        if self.consecutive_weak_turns >= 2:
            return "HINT"
        if self.last_quality == "confused":
            return "SIMPLIFY"
        if self.consecutive_strong_turns >= 2:
            return "CHALLENGE"
        if self.last_quality == "strong":
            return "ADVANCE"
        if self.last_quality in {"weak", "no_answer"}:
            return "PROBE"
        return "PROBE" if self.turn_count > 0 else "WAIT"

    def get_backchannel(self, tone: str = "neutral") -> str:
        pool_name = tone if tone in BACKCHANNELS else "neutral"
        candidates = BACKCHANNELS.get(pool_name, BACKCHANNELS["neutral"]) + BACKCHANNELS["silence"]
        blocked = set(self.recent_backchannels[-3:])
        filtered = [(phrase, duration) for phrase, duration in candidates if phrase not in blocked]
        if not filtered:
            filtered = candidates
        choice = random.choice(filtered)[0]
        self.recent_backchannels.append(choice)
        self.recent_backchannels = self.recent_backchannels[-3:]
        return choice

    def build_llm_context(self) -> str:
        recent_turns = self.transcript_history[-4:]
        conversation_lines = []
        for turn in recent_turns:
            role = "Candidate" if turn.get("role") == "candidate" else "Interviewer"
            conversation_lines.append(f"{role}: {turn.get('text', '').strip()}")
        if not conversation_lines:
            conversation_lines.append("Interviewer: (conversation just started)")

        draft_answer = " ".join(
            [part for part in [*self.current_answer_parts, self.latest_interim_transcript] if (part or "").strip()]
        ).strip()
        draft_line = f"LATEST CANDIDATE ANSWER DRAFT: {draft_answer}\n\n" if draft_answer else ""

        code_block = ""
        if self.session_phase == "dsa":
            age_seconds = max(0, int(_now() - self.last_code_change_at)) if self.last_code_change_at else 0
            code_block = (
                f"\nCANDIDATE'S CODE RIGHT NOW:\n"
                f"```{self.current_language}\n"
                f"{self.current_code or '(no code written yet)'}\n"
                f"```\n"
                f"Last run: {self.last_execution_output or 'not executed'}\n"
                f"Errors: {'yes' if self.code_has_errors else 'no'}\n"
                f"Last changed: {age_seconds} seconds ago\n"
            )

        confidence_trend = "steady"
        if self.consecutive_strong_turns:
            confidence_trend = f"strong for {self.consecutive_strong_turns} turn(s)"
        elif self.consecutive_weak_turns:
            confidence_trend = f"weak for {self.consecutive_weak_turns} turn(s)"

        hedge_band = "low"
        if self.hedge_count_this_session >= 8:
            hedge_band = "high"
        elif self.hedge_count_this_session >= 3:
            hedge_band = "medium"

        misconception_line = ""
        if self.last_detected_misconception:
            misconception_line = f"\nMOST RECENT MISCONCEPTION: {self.last_detected_misconception}\n"

        out = (
            f"INTERVIEW SESSION - Turn {self.turn_count}\n"
            f"Phase: {self.session_phase}\n\n"
            f"CONVERSATION SO FAR:\n"
            f"{chr(10).join(conversation_lines)}\n"
            f"{draft_line}"
            f"{code_block}"
            f"{misconception_line}"
            f"CANDIDATE SIGNALS THIS SESSION:\n"
            f"- Confidence trend: {confidence_trend}\n"
            f"- Hedging language: {hedge_band}\n"
            f"- Turn count: {self.turn_count}\n"
            f"- Last answer duration: {self.last_answer_duration:.1f}s\n"
            f"- Pause before last response: {self.pause_before_last_response:.0f}ms\n\n"
            f"YOUR NEXT ACTION: {self.decide_next_action()}\n"
            f"DO NOT use any of these acknowledgments (used recently): {self.recent_backchannels}\n"
        )
        if getattr(self, "large_paste_occurred", False):
            out += "\n[SYSTEM NOTE: The candidate just pasted a large block of code. Acknowledge briefly and focus on understanding or testing it rather than asking them to type it from scratch.]\n"
            self.large_paste_occurred = False
        return out

    def serialize(self) -> Dict[str, Any]:
        return {
            "transcript_history": self.transcript_history,
            "latest_interim_transcript": self.latest_interim_transcript,
            "current_answer_parts": self.current_answer_parts,
            "current_code": self.current_code,
            "previous_code": self.previous_code,
            "current_language": self.current_language,
            "last_execution_output": self.last_execution_output,
            "code_has_errors": self.code_has_errors,
            "last_code_change_at": self.last_code_change_at,
            "turn_count": self.turn_count,
            "session_phase": self.session_phase,
            "session_start_time": self.session_start_time,
            "recent_backchannels": self.recent_backchannels,
            "pause_before_last_response": self.pause_before_last_response,
            "last_answer_duration": self.last_answer_duration,
            "consecutive_weak_turns": self.consecutive_weak_turns,
            "consecutive_strong_turns": self.consecutive_strong_turns,
            "hedge_count_this_session": self.hedge_count_this_session,
            "last_quality": self.last_quality,
            "last_confidence_signal": self.last_confidence_signal,
            "last_recommended_action": self.last_recommended_action,
            "last_detected_misconception": self.last_detected_misconception,
        }

    @classmethod
    def load(cls, data: Optional[Dict[str, Any]]) -> "SessionConductor":
        if not isinstance(data, dict):
            logger.warning("SessionConductor.load: data is not a dict")
            return cls()
        try:
            turn_count = int(data.get("turn_count") or 0)
            if turn_count < 0:
                logger.warning("SessionConductor.load: turn_count < 0")
                return cls()
            transcript_history = data.get("transcript_history")
            if transcript_history is not None and not isinstance(transcript_history, list):
                logger.warning("SessionConductor.load: transcript_history is not a list")
                return cls()
            phase = str(data.get("session_phase") or "greeting")
            if phase not in VALID_PHASES:
                logger.warning("SessionConductor.load: invalid phase %r", phase)
                return cls()
        except (TypeError, ValueError) as e:
            logger.warning("SessionConductor.load: validation error %s", e)
            return cls()
        return cls(
            transcript_history=list(transcript_history or []),
            latest_interim_transcript=str(data.get("latest_interim_transcript") or ""),
            current_answer_parts=list(data.get("current_answer_parts") or []),
            current_code=str(data.get("current_code") or ""),
            previous_code=str(data.get("previous_code") or ""),
            current_language=str(data.get("current_language") or "python"),
            last_execution_output=data.get("last_execution_output"),
            code_has_errors=bool(data.get("code_has_errors")),
            last_code_change_at=float(data.get("last_code_change_at") or 0.0),
            turn_count=turn_count,
            session_phase=phase,
            session_start_time=float(data.get("session_start_time") or _now()),
            recent_backchannels=list(data.get("recent_backchannels") or []),
            pause_before_last_response=float(data.get("pause_before_last_response") or 0.0),
            last_answer_duration=float(data.get("last_answer_duration") or 0.0),
            consecutive_weak_turns=int(data.get("consecutive_weak_turns") or 0),
            consecutive_strong_turns=int(data.get("consecutive_strong_turns") or 0),
            hedge_count_this_session=int(data.get("hedge_count_this_session") or 0),
            last_quality=data.get("last_quality"),
            last_confidence_signal=data.get("last_confidence_signal"),
            last_recommended_action=data.get("last_recommended_action"),
            last_detected_misconception=data.get("last_detected_misconception"),
        )
