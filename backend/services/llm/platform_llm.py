"""Shared platform LLM facade for non-interview services."""
from functools import lru_cache

from config import get_settings
from services.interview.llm_engine import LLMEngine


@lru_cache(maxsize=1)
def get_platform_llm() -> LLMEngine:
    return LLMEngine(get_settings())
