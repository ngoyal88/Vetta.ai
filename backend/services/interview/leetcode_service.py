import re
import uuid
from typing import Any, Dict, List, Optional

import httpx

from utils.logger import get_logger

logger = get_logger("LeetCodeService")
_BASE = "https://leetcode-api-pied.vercel.app"

# Tags to exclude from DSA coding round (reserved for a separate Database phase)
DSA_EXCLUDE_TOPICS = ["Database"]


def _problem_has_excluded_topic(full: Dict[str, Any], exclude_topics: List[str]) -> bool:
    """True if any of the problem's topic tags are in exclude_topics (case-insensitive)."""
    if not exclude_topics:
        return False
    tags = [t.get("name") or "" for t in (full.get("topicTags") or []) if isinstance(t, dict)]
    exclude_set = {t.lower() for t in exclude_topics}
    return any((t or "").lower() in exclude_set for t in tags)


class LeetCodeService:
    async def get_random_problem(
        self,
        difficulty: str,
        exclude_topics: Optional[List[str]] = None,
        max_retries: int = 5,
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch a random problem with full content.
        The /random endpoint returns only minimal data (id, title_slug, difficulty).
        We then fetch the full problem via /problem/{slug} to get content, hints, tags.
        If exclude_topics is set (e.g. ["Database"]), retries until a problem without
        those tags is found, so DSA round can skip Database/SQL for a separate phase.
        """
        cap = difficulty.capitalize()
        async with httpx.AsyncClient(timeout=20) as client:
            for attempt in range(max_retries):
                # Step 1: get a random problem stub
                r = await client.get(f"{_BASE}/random", params={"difficulty": cap})
                r.raise_for_status()
                stub = r.json()

                slug = stub.get("title_slug") or stub.get("titleSlug")
                if not slug:
                    logger.warning("Random problem stub missing title_slug: %s", stub)
                    return stub  # best-effort fallback

                # Step 2: fetch full problem details
                r2 = await client.get(f"{_BASE}/problem/{slug}")
                r2.raise_for_status()
                full = r2.json()

                # Merge: full details take priority, but keep difficulty from stub if missing
                if not full.get("difficulty"):
                    full["difficulty"] = stub.get("difficulty", difficulty)

                if not _problem_has_excluded_topic(full, exclude_topics or []):
                    return full
                logger.debug("Skipping problem (excluded topic): %s", full.get("title"))

            logger.warning("No random problem found after %d attempts (exclude_topics=%s)", max_retries, exclude_topics)
            return None

    def clean_content(self, text: str) -> str:
        """
        Normalize the plain-text content returned by the LeetCode API.
        The API already returns decoded plain text (not HTML), but it may contain
        HTML entity remnants and excessive whitespace.
        """
        if not text:
            return ""
        # Decode any residual HTML entities
        replacements = {
            '&nbsp;': ' ', '&lt;': '<', '&gt;': '>',
            '&amp;': '&', '&#39;': "'", '&quot;': '"',
            '&le;': '<=', '&ge;': '>=', '&ne;': '!=',
        }
        for entity, char in replacements.items():
            text = text.replace(entity, char)
        # Collapse 3+ consecutive newlines to 2
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    def normalize(self, raw: Dict[str, Any], difficulty: str) -> Dict[str, Any]:
        """Convert the LeetCode API response to the inner DSA object shape."""
        # The /problem/{slug} endpoint returns content as HTML
        content_html = raw.get("content") or ""
        content_plain = self.clean_content(content_html)
        hints = raw.get("hints") or []
        tags = [t["name"] for t in (raw.get("topicTags") or []) if isinstance(t, dict)]

        # Use the difficulty from the raw response if available (more accurate)
        raw_difficulty = (raw.get("difficulty") or difficulty).lower()

        return {
            "question_id": str(uuid.uuid4()),
            "leetcode_id": raw.get("questionId") or raw.get("questionFrontendId"),
            "leetcode_slug": raw.get("titleSlug") or raw.get("title_slug"),
            "title": raw.get("title", "Untitled"),
            "description": content_html,
            "description_is_html": True,    # content is HTML from /problem/{slug}
            "description_plain": content_plain,
            "constraints": [],
            "hints": hints,
            "tags": tags,
            "difficulty": raw_difficulty,
            "type": "coding",
            "starter_code": {},
            "test_cases": [],
            "examples": [],
            "example": {},
        }

