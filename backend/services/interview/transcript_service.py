"""Extract and persist interview dialogue from session_conductor transcript history."""
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from utils.logger import get_logger

logger = get_logger("TranscriptService")

MAX_TRANSCRIPT_ENTRIES = 300
MAX_TEXT_CHARS = 2000
MAX_SERIALIZED_BYTES = 400_000

_SPEAKER_MAP = {
    "candidate": "candidate",
    "interviewer": "interviewer",
    "assistant": "interviewer",
}


def _normalize_timestamp(value: Any) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat()
        except (OSError, OverflowError, ValueError):
            return datetime.now(timezone.utc).isoformat()
    if isinstance(value, str) and value.strip():
        return value.strip()
    return datetime.now(timezone.utc).isoformat()


def _normalize_speaker(role: Any) -> Optional[str]:
    key = str(role or "").strip().lower()
    if not key:
        return None
    return _SPEAKER_MAP.get(key, "interviewer")


def extract_assistant_transcript_text(item: Any) -> str:
    """Extract spoken assistant text from a LiveKit conversation item."""
    if not item:
        return ""
    role = getattr(item, "role", None)
    if role not in {"assistant", "agent"}:
        return ""
    item_type = getattr(item, "type", "message")
    if item_type not in {"message", None}:
        return ""

    text_content = getattr(item, "text_content", None)
    if isinstance(text_content, str) and text_content.strip():
        return text_content.strip()

    content = getattr(item, "content", None)
    if isinstance(content, str) and content.strip():
        return content.strip()
    if isinstance(content, list):
        parts: List[str] = []
        for chunk in content:
            if isinstance(chunk, str) and chunk.strip():
                parts.append(chunk.strip())
                continue
            chunk_text = getattr(chunk, "text", None)
            if isinstance(chunk_text, str) and chunk_text.strip():
                parts.append(chunk_text.strip())
        if parts:
            return " ".join(parts)

    fallback = getattr(item, "text", None)
    if isinstance(fallback, str) and fallback.strip():
        return fallback.strip()
    return ""


def extract_live_transcription(session_data: Optional[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Build normalized live_transcription from session_conductor.transcript_history."""
    if not isinstance(session_data, dict):
        return []

    conductor = session_data.get("session_conductor")
    if isinstance(conductor, str):
        try:
            conductor = json.loads(conductor)
        except json.JSONDecodeError:
            conductor = {}
    if not isinstance(conductor, dict):
        conductor = {}

    raw_history = conductor.get("transcript_history")
    if not isinstance(raw_history, list):
        return []

    out: List[Dict[str, str]] = []
    for entry in raw_history:
        if not isinstance(entry, dict):
            continue
        speaker = _normalize_speaker(entry.get("role"))
        text = str(entry.get("text") or "").strip()[:MAX_TEXT_CHARS]
        if not speaker or not text:
            continue
        out.append(
            {
                "speaker": speaker,
                "text": text,
                "timestamp": _normalize_timestamp(entry.get("timestamp")),
            }
        )
        if len(out) >= MAX_TRANSCRIPT_ENTRIES:
            break
        serialized = json.dumps(out, ensure_ascii=False)
        if len(serialized.encode("utf-8")) >= MAX_SERIALIZED_BYTES:
            out.pop()
            break

    return out


def attach_transcript_to_session(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Populate session_data live_transcription from conductor history (idempotent)."""
    extracted = extract_live_transcription(session_data)
    if extracted:
        session_data["live_transcription"] = extracted
    elif not session_data.get("live_transcription"):
        session_data["live_transcription"] = []
    return session_data
