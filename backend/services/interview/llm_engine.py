"""LLM provider selection and call orchestration for interview flows."""
import asyncio
from typing import Any, AsyncGenerator, Optional

from config import Settings
from services.integrations import GeminiService, GroqService
from utils.logger import get_logger
from utils.response_validator import process_response

logger = get_logger("LLMEngine")


class LLMEngine:
    """Holds primary / eval / fallback LLM clients and shared retry + fallback call logic."""

    def __init__(self, settings: Settings) -> None:
        provider = (settings.llm_provider or "").lower()
        logger.info(
            "LLM config: provider=%s groq_key=%s gemini_key=%s",
            provider or "<unset>",
            "yes" if settings.groq_api_key else "no",
            "yes" if settings.llm_api_key else "no",
        )

        if provider == "groq":
            if settings.groq_api_key:
                self.primary = GroqService()
            else:
                logger.warning("groq selected but GROQ_API_KEY missing; falling back to Gemini")
                self.primary = GeminiService()
        elif provider == "gemini":
            if settings.llm_api_key:
                self.primary = GeminiService()
            elif settings.groq_api_key:
                logger.info("Gemini key missing; falling back to Groq")
                self.primary = GroqService()
            else:
                logger.warning("No LLM keys configured")
                self.primary = GeminiService()
        else:
            if settings.groq_api_key:
                self.primary = GroqService()
            else:
                self.primary = GeminiService()

        self.eval_llm = GroqService() if settings.groq_api_key else self.primary

        self.fallback: Optional[Any] = None
        if provider == "groq" and getattr(settings, "llm_api_key", None):
            self.fallback = GeminiService()
        elif provider == "gemini" and getattr(settings, "groq_api_key", None):
            self.fallback = GroqService()
        elif provider not in ("groq", "gemini") and settings.groq_api_key and settings.llm_api_key:
            self.fallback = (
                GeminiService() if self.primary.__class__.__name__ == "GroqService" else GroqService()
            )

    def _is_retryable_error(self, e: Exception) -> bool:
        code = getattr(e, "status_code", None) or getattr(e, "code", None)
        if code is not None:
            try:
                return int(code) in (429, 500, 503)
            except (ValueError, TypeError):
                pass
        msg = str(e.args[0]) if e.args else str(e)
        return "429" in msg or "500" in msg or "503" in msg or "timeout" in msg.lower()

    def _looks_like_provider_error_text(self, text: str) -> bool:
        t = (text or "").strip().lower()
        if not t:
            return True
        markers = (
            "error generating response",
            "rate limit",
            "rate_limit_exceeded",
            "too many requests",
            "apiconnectionerror",
            "failed to generate llm completion",
            "service not configured",
        )
        return any(m in t for m in markers)

    async def _call_llm_with_fallback(
        self,
        prompt: str,
        temperature: float = 0.7,
        llm: Optional[Any] = None,
        fallback_llm: Optional[Any] = None,
    ) -> str:
        llm = llm if llm is not None else self.primary
        fallback_llm = fallback_llm if fallback_llm is not None else self.fallback
        safe_fallback = "I'm having trouble generating a response right now. Could you try rephrasing or continuing?"

        async def _try_one(provider_llm: Any, validate: bool = True) -> Optional[str]:
            try:
                raw = await asyncio.wait_for(
                    provider_llm.generate_text(prompt, temperature=temperature),
                    15.0,
                )
                if not raw:
                    return None
                if self._looks_like_provider_error_text(raw):
                    logger.warning("LLM returned provider error-like text; trying fallback")
                    return None
                if validate:
                    return process_response(raw)
                return raw.strip() or None
            except asyncio.TimeoutError:
                logger.warning("LLM call timed out after 15s")
                return None
            except Exception as e:
                if self._is_retryable_error(e):
                    logger.warning("LLM retryable error: %s", e)
                else:
                    logger.error("LLM error: %s", e, exc_info=True)
                return None

        result = await _try_one(llm)
        if result:
            return result
        if fallback_llm and fallback_llm is not llm:
            logger.info("Trying fallback LLM provider")
            result = await _try_one(fallback_llm)
            if result:
                return result
        return safe_fallback

    async def _call_llm_raw_with_fallback(
        self,
        prompt: str,
        temperature: float = 0.0,
        llm: Optional[Any] = None,
        fallback_llm: Optional[Any] = None,
        empty_fallback: str = "{}",
    ) -> str:
        """Call LLM with fallback; return raw string (no response validation). For JSON etc."""
        llm = llm if llm is not None else self.primary
        fallback_llm = fallback_llm if fallback_llm is not None else self.fallback

        async def _try_one(provider_llm: Any) -> Optional[str]:
            try:
                raw = await asyncio.wait_for(
                    provider_llm.generate_text(prompt, temperature=temperature),
                    15.0,
                )
                if self._looks_like_provider_error_text(raw or ""):
                    logger.warning("LLM returned provider error-like text; trying fallback")
                    return None
                return (raw or "").strip() or None
            except asyncio.TimeoutError:
                logger.warning("LLM call timed out after 15s")
                return None
            except Exception as e:
                if self._is_retryable_error(e):
                    logger.warning("LLM retryable error: %s", e)
                else:
                    logger.error("LLM error: %s", e, exc_info=True)
                return None

        result = await _try_one(llm)
        if result:
            return result
        if fallback_llm and fallback_llm is not llm:
            result = await _try_one(fallback_llm)
            if result:
                return result
        return empty_fallback

    async def generate(self, prompt: str, temperature: float = 0.7) -> str:
        return await self._call_llm_with_fallback(prompt, temperature)

    async def generate_raw(
        self,
        prompt: str,
        temperature: float = 0.0,
        *,
        llm: Optional[Any] = None,
        fallback_llm: Optional[Any] = None,
        empty_fallback: str = "{}",
    ) -> str:
        return await self._call_llm_raw_with_fallback(
            prompt, temperature, llm, fallback_llm, empty_fallback
        )

    async def generate_stream(self, prompt: str, temperature: float = 0.8) -> AsyncGenerator[str, None]:
        if hasattr(self.primary, "generate_text_stream"):
            async for chunk in self.primary.generate_text_stream(prompt, temperature=temperature):
                yield chunk
            return
        text = await self._call_llm_with_fallback(prompt, temperature)
        yield (text or "").strip()

    async def json_completion(self, system_prompt: str, user_prompt: str) -> str:
        if hasattr(self.eval_llm, "json_completion"):
            return await self.eval_llm.json_completion(system_prompt, user_prompt)
        return await self._call_llm_raw_with_fallback(
            f"{system_prompt}\n\n{user_prompt}",
            0.0,
            llm=self.eval_llm,
            fallback_llm=self.fallback,
            empty_fallback="{}",
        )
