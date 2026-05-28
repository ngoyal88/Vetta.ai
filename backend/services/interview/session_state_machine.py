from __future__ import annotations

from services.interview.contracts.session_events import (
    SessionEvent,
    SessionEventType,
    SessionLifecycleState,
)


class SessionStateMachine:
    TERMINAL = {
        SessionLifecycleState.ENDED_EARLY,
        SessionLifecycleState.COMPLETED,
        SessionLifecycleState.INCOMPLETE_EXIT,
    }

    @classmethod
    def transition(
        cls,
        current_state: str,
        event: SessionEvent,
    ) -> SessionLifecycleState:
        state = SessionLifecycleState(current_state or SessionLifecycleState.ACTIVE.value)
        if state in cls.TERMINAL:
            return state
        if event.type in {
            SessionEventType.SILENCE_TIMEOUT,
            SessionEventType.MANUAL_END,
            SessionEventType.ERROR_END,
            SessionEventType.TAB_AWAY_TIMEOUT,
            SessionEventType.MAX_DURATION,
        }:
            return SessionLifecycleState.ENDED_EARLY
        if event.type == SessionEventType.DISCONNECT_TIMEOUT:
            return SessionLifecycleState.INCOMPLETE_EXIT
        if event.type == SessionEventType.COMPLETE:
            return SessionLifecycleState.COMPLETED
        return SessionLifecycleState.ACTIVE
