# utils/response_validator.py — sanitize and validate LLM text responses
import re
from typing import Optional

BAD_PREFIXES = (
    "I'm sorry",
    "I am sorry",
    "Sorry,",
    "I cannot",
    "I can't",
    "As an AI",
    "As a language model",
    "I don't have",
    "I do not have",
)

BAD_PATTERNS = [
    re.compile(r"\b(cannot|can't) (answer|provide|help|assist|generate)", re.I),
    re.compile(r"\b(as an (ai|assistant|language model))\b", re.I),
    re.compile(r"\b(apologize|apologise)\s*(,|\.|\b)", re.I),
]

MARKDOWN_TO_STRIP = [
    (re.compile(r"^```\w*\s*", re.MULTILINE), ""),
    (re.compile(r"\s*```\s*$", re.MULTILINE), ""),
    (re.compile(r"^\s*#+\s*", re.MULTILINE), ""),
]


def sanitize_response(raw: Optional[str]) -> str:
    if raw is None:
        return ""
    text = (raw or "").strip()
    for pattern, replacement in MARKDOWN_TO_STRIP:
        text = pattern.sub(replacement, text)
    return text.strip()


def validate_response(text: str) -> bool:
    if not text or len(text) < 2:
        return False
    lower = text.lower()
    for prefix in BAD_PREFIXES:
        if lower.startswith(prefix.lower()):
            return False
    for pat in BAD_PATTERNS:
        if pat.search(text):
            return False
    return True


def process_response(raw: Optional[str]) -> Optional[str]:
    """Sanitize then validate; return cleaned string or None if invalid."""
    cleaned = sanitize_response(raw)
    if not validate_response(cleaned):
        return None
    return cleaned
