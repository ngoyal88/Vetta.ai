"""LiveKit data-channel publishing for interview control/audio messages."""
import json
import base64
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from utils.logger import get_logger

logger = get_logger("LiveKitTransport")

CONTROL_PAYLOAD_MAX = 14000
AUDIO_CHUNK_PAYLOAD_MAX = 12000


class LiveKitTransport:
    def __init__(self, room: Any, get_current_phase_fn: Callable[[], str]) -> None:
        self._room = room
        self._get_phase = get_current_phase_fn
        self.connected = True

    async def _send_message(self, message: Dict[str, Any]) -> None:
        if not self.connected or not self._room or not self._room.local_participant:
            return
        try:
            payload = json.dumps(message).encode("utf-8")
            if len(payload) <= CONTROL_PAYLOAD_MAX:
                await self._room.local_participant.publish_data(
                    payload, reliable=True, topic="control"
                )
            else:
                await self._send_chunked_question(message, payload)
        except Exception as e:
            logger.error("Failed to send message: %s", e, exc_info=True)

    async def _send_chunked_question(self, message: Dict[str, Any], raw_payload: bytes) -> None:
        """Send question with large audio as chunked: header on control + audio_chunk messages."""
        if message.get("type") != "question" or "audio" not in message:
            logger.warning("Chunking only supported for question with audio; truncating")
            await self._room.local_participant.publish_data(
                raw_payload[:CONTROL_PAYLOAD_MAX], reliable=True, topic="control"
            )
            return
        question_id = str(uuid.uuid4())
        audio_b64 = message.get("audio") or ""
        total_chunks = (len(audio_b64) + AUDIO_CHUNK_PAYLOAD_MAX - 1) // AUDIO_CHUNK_PAYLOAD_MAX if audio_b64 else 0
        header = {
            "type": "question_chunked",
            "question_id": question_id,
            "total_chunks": total_chunks,
            "question": message.get("question"),
            "phase": message.get("phase"),
            "spoken_text": message.get("spoken_text"),
            "timestamp": message.get("timestamp"),
        }
        header_msg = json.dumps(header).encode("utf-8")
        await self._room.local_participant.publish_data(header_msg, reliable=True, topic="control")

        for idx, i in enumerate(range(0, len(audio_b64), AUDIO_CHUNK_PAYLOAD_MAX)):
            chunk_data = audio_b64[i : i + AUDIO_CHUNK_PAYLOAD_MAX]
            chunk_msg = json.dumps(
                {
                    "type": "audio_chunk",
                    "question_id": question_id,
                    "chunk_index": idx,
                    "total_chunks": total_chunks,
                    "data": chunk_data,
                }
            ).encode("utf-8")
            await self._room.local_participant.publish_data(chunk_msg, reliable=True, topic="audio_chunk")

    async def send_message(self, message: Dict[str, Any]) -> None:
        await self._send_message(message)

    async def send_question(
        self,
        question: Dict[str, Any],
        audio: Optional[bytes],
        spoken_text: Optional[str] = None,
        stream_id: Optional[str] = None,
    ) -> None:
        inner = self._get_dsa_inner_question(question) or question
        message: Dict[str, Any] = {
            "type": "question",
            "question": inner,
            "phase": self._get_phase(),
            "spoken_text": spoken_text,
            "stream_id": stream_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if audio:
            message["audio"] = base64.b64encode(audio).decode("utf-8")
            message["audio_content_type"] = "audio/mpeg"
        else:
            message["audio"] = None
        await self._send_message(message)
        logger.info("Sent question" + (" with audio" if audio else " (no audio)"))

    async def send_transcript(self, text: str, is_final: bool) -> None:
        await self.send_message({
            "type": "transcript", "text": text, "is_final": is_final,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def send_status(self, status: str) -> None:
        await self.send_message({
            "type": "status", "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def send_error(self, error_message: str) -> None:
        await self.send_message({
            "type": "error", "message": error_message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def _get_dsa_inner_question(self, payload: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None
        if payload.get("type") == "coding" and isinstance(payload.get("question"), dict):
            return payload["question"]
        if isinstance(payload.get("title"), str) and "test_cases" in payload:
            return payload
        return None
