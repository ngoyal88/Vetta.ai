"""Redis session access with optimistic updates for concurrent writers."""
import json
from collections.abc import Callable
from typing import Any, Optional

from config import get_settings
from utils.redis_client import get_session, merge_session, update_session_atomic

_settings = get_settings()
DEFAULT_SESSION_TTL = getattr(_settings, "interview_session_ttl_seconds", 7200)


class SessionStore:
    """Typed wrapper around interview session keys in Redis."""

    def __init__(
        self,
        session_key: str,
        *,
        redis_client: Optional[Any] = None,
        ttl: int = DEFAULT_SESSION_TTL,
    ) -> None:
        self.session_key = (
            session_key if session_key.startswith("interview:") else f"interview:{session_key}"
        )
        self.redis_client = redis_client
        self.ttl = ttl

    @classmethod
    def for_session(cls, session_id: str, **kwargs: Any) -> "SessionStore":
        return cls(f"interview:{session_id}", **kwargs)

    async def get(self) -> Optional[dict]:
        if self.redis_client is not None:
            raw = await self.redis_client.get(self.session_key)
            return json.loads(raw) if raw else None
        return await get_session(self.session_key)

    async def patch(self, patch: dict) -> dict:
        return await merge_session(
            self.session_key,
            patch,
            expire_seconds=self.ttl,
            redis_client=self.redis_client,
        )

    async def replace(self, data: dict) -> dict:
        return await update_session_atomic(
            self.session_key,
            lambda _current: data,
            expire_seconds=self.ttl,
            redis_client=self.redis_client,
        )

    async def update(self, mutator: Callable[[dict], dict]) -> dict:
        return await update_session_atomic(
            self.session_key,
            mutator,
            expire_seconds=self.ttl,
            redis_client=self.redis_client,
        )
