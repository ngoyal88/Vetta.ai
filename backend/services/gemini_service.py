# ========================================
# 3. services/gemini_service.py - Clean Gemini integration
# ========================================

import google.generativeai as genai
from config import get_settings
from utils.logger import get_logger
from typing import List, Dict

logger = get_logger("GeminiService")
settings = get_settings()


class GeminiService:
    def __init__(self):
        if settings.llm_api_key:
            genai.configure(api_key=settings.llm_api_key)
            self.model = genai.GenerativeModel(settings.llm_model)
            logger.info("Gemini service initialized")
        else:
            logger.error("Gemini API key not configured")
            self.model = None
    
    async def generate_text(self, prompt: str, temperature: float = None) -> str:
        """Generate text response from Gemini"""
        if not self.model:
            return "LLM service not configured"
        
        try:
            temp = temperature or settings.llm_temperature
            
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": temp,
                    "max_output_tokens": settings.llm_max_tokens,
                }
            )
            # Try quick accessor and log finish details when absent
            try:
                return response.text if response.text else "No response generated"
            except Exception:
                # Log candidates length and known finish reason fields if present
                finish = None
                candidates_len = None
                try:
                    if hasattr(response, 'candidates') and response.candidates is not None:
                        candidates_len = len(response.candidates)
                        # try to read finish_reason from first candidate
                        first = response.candidates[0] if candidates_len else None
                        finish = getattr(first, 'finish_reason', None)
                except Exception:
                    pass
                logger.warning(f"Gemini returned no text. candidates={candidates_len} finish_reason={finish}")
                return "No response generated"
            
        except Exception as e:
            logger.error(f"Gemini generation error: {e}", exc_info=True)
            return f"Error generating response: {str(e)}"
    
    async def chat(self, messages: List[Dict[str, str]]) -> str:
        """Chat with conversation history"""
        if not self.model:
            return "LLM service not configured"
        
        try:
            # Convert messages to prompt
            prompt = "\n".join([f"{msg['role']}: {msg['content']}" for msg in messages])
            return await self.generate_text(prompt)
            
        except Exception as e:
            logger.error(f"Chat error: {e}", exc_info=True)
            return f"Error in chat: {str(e)}"

