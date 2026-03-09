import os
import secrets
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM
    llm_provider: str = "groq"  # gemini | groq
    llm_api_key: str = ""
    llm_model: str = "gemini-2.5-flash"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 6000

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # LiveKit
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # Speech: STT / TTS
    deepgram_api_key: str = ""                     
    deepgram_model: str = "nova-2"  # e.g. nova-2 (recommended), nova-2-general
    
    elevenlabs_api_key: str = ""

    # Default Edge TTS (no key). Switch to ElevenLabs via TTS_PROVIDER=elevenlabs.
    tts_provider: str = "edge"  # edge | elevenlabs

    # Edge TTS settings (no API key required)
    edge_tts_voice: str = "en-US-JennyNeural"
    edge_tts_rate: str = "+0%"
    edge_tts_pitch: str = "+0Hz"

    # Code execution (Judge0)
    judge0_api_key: str = ""
    judge0_host: str = "judge0-ce.p.rapidapi.com"
    
    # Redis: REDIS_URL (Upstash) or REDIS_HOST/PORT/PASSWORD/SSL
    redis_url: str = ""  # If set, used instead of host/port/password/ssl
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str = ""
    redis_ssl: bool = False  # Set True for production/remote Redis; False for localhost
    
    # Firebase
    firebase_project_id: str = ""
    firebase_credentials_path: str = "serviceAccount.json"
    
    # Security
    api_token: str = os.getenv("API_TOKEN", "")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "")
    jwt_algorithm: str = "HS256"
    sentry_dsn: str = os.getenv("SENTRY_DSN", "")
    
    # CORS
    allowed_origins: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:5174")
    allowed_origin_regex: str = os.getenv("ALLOWED_ORIGIN_REGEX", "")
    
    # Interview
    max_interview_duration_minutes: int = 60
    max_questions_per_interview: int = 15
    dsa_time_limit_minutes: int = 45
    interview_session_ttl_seconds: int = 7200  # Redis TTL for interview sessions
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "console"
    
    # Allow extra env vars (e.g. DEBUG, FIREBASE_CREDENTIALS) without raising,
    # so .env can contain additional keys that Settings doesn't explicitly model.
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    def jwt_key(self) -> str:
        """Return a non-empty JWT secret key. Generates a random dev key if unset."""
        if self.jwt_secret_key:
            return self.jwt_secret_key
        # Fallback: ephemeral key for local/dev only. Set JWT_SECRET_KEY in production.
        return secrets.token_urlsafe(64)

    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    def allowed_origin_regex_value(self) -> Optional[str]:
        value = (self.allowed_origin_regex or "").strip()
        return value or None


@lru_cache
def get_settings() -> Settings:
    return Settings()