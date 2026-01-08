# services/groq_service.py
from typing import List, Dict, Optional
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
                logger.warning(f"Invalid Groq model '{self.model}' for chat; falling back to 'llama-3.1-8b-instant'")
                self.model = "llama-3.1-8b-instant"
        except Exception:
            self.model = "llama-3.1-8b-instant"
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

    async def chat(self, messages: List[Dict[str, str]]) -> str:
        if not self.client:
            return "LLM service not configured"
        try:
            chat_completion = self.client.chat.completions.create(
                messages=messages,
                model=self.model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=False,
            )
            choice = (chat_completion.choices or [None])[0]
            content = getattr(choice, "message", None).content if choice and getattr(choice, "message", None) else None
            return content or "No response generated"
        except Exception as e:
            logger.error(f"Groq chat error: {e}", exc_info=True)
            return f"Error in chat: {str(e)}"
