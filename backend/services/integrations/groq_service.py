# DEPRECATED: Direct Groq HTTP client used by InterviewService (interview_websocket path).
# The agent uses livekit.plugins.groq directly. Can be deleted once interview_service.py
# no longer falls back to this for the WebSocket flow.
# NOTE: InterviewService still imports this for fallback question/feedback generation.
import asyncio
import threading
from typing import AsyncGenerator, List, Dict, Optional
from groq import Groq
from config import get_settings
from utils.logger import get_logger

logger = get_logger("GroqService")
settings = get_settings()


class GroqService:
    """Groq LLM client using the official SDK, compatible with InterviewService."""

    def __init__(self):
        # Guard models are not suitable for chat; pick a valid default
        self.model = settings.groq_model
        try:
            m = (self.model or "").lower()
            if ("guard" in m) or (not m.strip()):
                logger.warning(f"Invalid Groq model '{self.model}' for chat; falling back to 'llama-3.3-70b-versatile'")
                self.model = "llama-3.3-70b-versatile"
        except Exception:
            self.model = "llama-3.3-70b-versatile"
        self.max_tokens = settings.llm_max_tokens
        self.temperature = settings.llm_temperature
        if not settings.groq_api_key:
            logger.error("Groq API key not configured")
            self.client = None
        else:
            self.client = Groq(api_key=settings.groq_api_key)

    async def generate_text(self, prompt: str, temperature: Optional[float] = None) -> str:
        """Generate text using Groq Chat Completions via SDK."""
        if not self.client:
            return "LLM service not configured"
        try:
            chat_completion = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=(temperature if temperature is not None else self.temperature),
                max_tokens=self.max_tokens,
                stream=False,
            )
            choice = (chat_completion.choices or [None])[0]
            content = getattr(choice, "message", None).content if choice and getattr(choice, "message", None) else None
            return content or "No response generated"
        except Exception as e:
            logger.error(f"Groq generation error: {e}", exc_info=True)
            return f"Error generating response: {str(e)}"

    async def generate_text_stream(
        self,
        prompt: str,
        temperature: Optional[float] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream text tokens from Groq without blocking the event loop."""
        if not self.client:
            yield "LLM service not configured"
            return

        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[object] = asyncio.Queue()
        sentinel = object()

        def _run_stream() -> None:
            try:
                stream = self.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.model,
                    temperature=(temperature if temperature is not None else self.temperature),
                    max_tokens=self.max_tokens,
                    stream=True,
                )
                for chunk in stream:
                    try:
                        delta = chunk.choices[0].delta.content
                    except Exception:
                        delta = None
                    if delta:
                        loop.call_soon_threadsafe(queue.put_nowait, delta)
            except Exception as e:
                logger.error(f"Groq streaming error: {e}", exc_info=True)
                loop.call_soon_threadsafe(queue.put_nowait, e)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, sentinel)

        threading.Thread(target=_run_stream, daemon=True).start()

        while True:
            item = await queue.get()
            if item is sentinel:
                break
            if isinstance(item, Exception):
                yield f"Error generating response: {item}"
                break
            yield str(item)

    async def json_completion(self, system_prompt: str, user_prompt: str) -> str:
        """
        Generate JSON via Groq with response_format=json_object.
        Uses GROQ_JSON_MODEL when set, otherwise GROQ_MODEL (same quality as chat extraction).
        """
        if not self.client:
            return "{}"

        def _clip(text: str, max_len: int) -> str:
            if not text:
                return ""
            text = text.strip()
            return text if len(text) <= max_len else text[:max_len]

        json_model = (getattr(settings, "groq_json_model", None) or "").strip() or self.model
        # Larger models can handle fuller JD Fit corpora; clip only for pathological prompts.
        sys_c = _clip(system_prompt, 12000)
        usr_c = _clip(user_prompt, 24000)
        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": sys_c},
                    {"role": "user", "content": usr_c},
                ],
                model=json_model,
                temperature=0.0,
                max_tokens=min(4096, int(self.max_tokens or 4096)),
                stream=False,
                response_format={"type": "json_object"},
            )
            choice = (chat_completion.choices or [None])[0]
            content = (
                getattr(choice, "message", None).content
                if choice and getattr(choice, "message", None)
                else None
            )
            return content or "{}"
        except Exception as e:
            logger.error(f"Groq JSON completion error (model={json_model}): {e}", exc_info=True)
            return "{}"

