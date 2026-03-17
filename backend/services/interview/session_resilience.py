# DEPRECATED: In-memory Redis fallback used by the legacy livekit_room_handler and redis_client.
# redis_client.py no longer imports this module. Can be deleted.
import threading
import time
from typing import Any, Dict, Optional

from utils.logger import get_logger

logger = get_logger("SessionResilience")

_memory_store: Dict[str, Dict[str, Any]] = {}
_store_lock = threading.Lock()
MAX_AGE_SECONDS = 7200


def memory_get(session_id: str) -> Optional[Dict[str, Any]]:
    with _store_lock:
        entry = _memory_store.get(session_id)
    if not entry:
        return None
    data = entry.get("data")
    at = entry.get("at") or 0
    if (time.time() - at) > MAX_AGE_SECONDS:
        with _store_lock:
            try:
                del _memory_store[session_id]
            except KeyError:
                pass
        return None
    return data


def memory_set(session_id: str, data: Dict[str, Any]) -> None:
    with _store_lock:
        _memory_store[session_id] = {"data": data, "at": time.time()}


def memory_delete(session_id: str) -> None:
    with _store_lock:
        try:
            del _memory_store[session_id]
        except KeyError:
            pass


def get_active_session_count() -> int:
    now = time.time()
    with _store_lock:
        count = 0
        for entry in _memory_store.values():
            at = entry.get("at") or 0
            if (now - at) <= MAX_AGE_SECONDS:
                count += 1
    return count
