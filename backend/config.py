import os
import secrets
from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    llm_provider: str = "groq"
    llm_api_key: str = ""
    llm_model: str = "gemini-2.5-flash"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 6000

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    livekit_agent_name: str = "vetta-interviewer"

    deepgram_api_key: str = ""
    deepgram_model: str = "nova-2"
    deepgram_endpointing_ms: int = 500

    elevenlabs_api_key: str = ""
    tts_provider: str = "edge"

    edge_tts_voice: str = "en-US-JennyNeural"
    edge_tts_rate: str = "+0%"
    edge_tts_pitch: str = "+0Hz"

    judge0_api_key: str = ""
    judge0_host: str = "judge0-ce.p.rapidapi.com"

    redis_url: str = ""
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str = ""
    redis_ssl: bool = False

    firebase_project_id: str = ""
    firebase_credentials_path: str = "serviceAccount.json"

    # Local vault files when Supabase is not configured (dev). Also used as on-disk mirror path segment.
    vault_storage_dir: str = "data/vault"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_vault_bucket: str = "Resume"

    api_token: str = os.getenv("API_TOKEN", "")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "")
    jwt_algorithm: str = "HS256"
    sentry_dsn: str = os.getenv("SENTRY_DSN", "")

    allowed_origins: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5174",
    )
    allowed_origin_regex: str = os.getenv("ALLOWED_ORIGIN_REGEX", "")

    max_interview_duration_minutes: int = 60
    silence_tier1_seconds: int = 60
    silence_tier2_seconds: int = 120
    silence_tier3_seconds: int = 180
    candidate_away_max_seconds: int = 600
    max_questions_per_interview: int = 15
    dsa_time_limit_minutes: int = 45
    interview_session_ttl_seconds: int = 7200

    # LiveKit: when True, TTS is streamed as tts_chunk (requires client handlers). False = single
    # question message with base64 audio (and optional chunking); works with useInterviewLiveKit AudioPlayer.
    streaming_tts_enabled: bool = False

    log_level: str = "INFO"
    log_format: str = "console"

    # Contact form (free options: Firestore only, Resend free tier, Gmail SMTP, Discord webhook)
    contact_recipient_email: str = "hello@vetta.ai"
    contact_from_email: str = ""
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    contact_discord_webhook_url: str = ""
    contact_rate_limit: int = 5
    contact_rate_window_seconds: int = 3600

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    def jwt_key(self) -> str:
        if self.jwt_secret_key:
            return self.jwt_secret_key
        return secrets.token_urlsafe(64)

    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    def allowed_origin_regex_value(self) -> Optional[str]:
        value = (self.allowed_origin_regex or "").strip()
        return value or None


@lru_cache
def get_settings() -> Settings:
    return Settings()
