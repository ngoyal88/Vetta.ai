"""Transport interface for interview session engine (WebSocket, LiveKit, etc.)."""
from typing import Any, Dict, Optional, Protocol, runtime_checkable


@runtime_checkable
class ITransport(Protocol):
    """Outbound-only channel; adapters implement transport-specific serialization."""

    @property
    def connected(self) -> bool: ...

    async def send_message(self, message: Dict[str, Any]) -> None: ...

    async def send_transcript(self, text: str, is_final: bool) -> None: ...

    async def send_status(self, status: str) -> None: ...

    async def send_error(self, message: str) -> None: ...

    async def send_question(
        self,
        question: Dict[str, Any],
        audio: Optional[bytes],
        spoken_text: Optional[str],
        stream_id: Optional[str] = None,
    ) -> None: ...

    async def speak(self, text: str, question_metadata: Dict[str, Any]) -> None: ...
