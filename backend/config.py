# ========================================
# 1. UPDATED config.py - Clean configuration
# ========================================

import os
import secrets
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---------- LLM Configuration (Gemini) ----------------------------- #
    llm_provider: str = "groq"  # gemini | groq
    llm_api_key: str = ""
    llm_model: str = "gemini-2.5-flash"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 6000

    # ---------- LLM Configuration (Groq) ------------------------------- #
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # ---------- LiveKit (Voice Infrastructure) ------------------------- #
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # ---------- Speech Services (Pipecat) ------------------------------ #
    # STT (Choose one)
    deepgram_api_key: str = ""                     
    deepgram_model: str = "nova-2"  # e.g. nova-2 (recommended), nova-2-general
    
    # TTS (Choose one)
    elevenlabs_api_key: str = ""      

    # ---------- TTS Provider (WebSocket MVP) -------------------------- #
    # For now we default to Edge TTS because ElevenLabs quota may be hit.
    # Switch back later by setting: TTS_PROVIDER=elevenlabs
    tts_provider: str = "edge"  # edge | elevenlabs

    # Edge TTS settings (no API key required)
    edge_tts_voice: str = "en-US-JennyNeural"
    edge_tts_rate: str = "+0%"
    edge_tts_pitch: str = "+0Hz"

    # ---------- Code Execution ----------------------------------------- #
    judge0_api_key: str = ""
    judge0_host: str = "judge0-ce.p.rapidapi.com"
    
    # ---------- Database ----------------------------------------------- #
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str = ""
    
    # ---------- Firebase ----------------------------------------------- #
    firebase_project_id: str = ""
    firebase_credentials_path: str = "serviceAccount.json"
    
    # ---------- Security ----------------------------------------------- #
    api_token: str = os.getenv("API_TOKEN", "")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "")
    jwt_algorithm: str = "HS256"
    
    # ---------- CORS --------------------------------------------------- #
    allowed_origins: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:5174")
    
    # ---------- Interview Settings ------------------------------------- #
    max_interview_duration_minutes: int = 60
    max_questions_per_interview: int = 15
    dsa_time_limit_minutes: int = 45
    
    # ---------- Logging ------------------------------------------------ #
    log_level: str = "INFO"
    log_format: str = "console"
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    def jwt_key(self) -> str:
        """Return a non-empty JWT secret key. Generates a random dev key if unset."""
        if self.jwt_secret_key:
            return self.jwt_secret_key
        # Fallback: ephemeral key for local/dev only. Set JWT_SECRET_KEY in production.
        return secrets.token_urlsafe(64)

    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()