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
            
            return response.text if response.text else "No response generated"
            
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

