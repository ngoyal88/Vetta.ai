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
    # When False (default), run the agent in a separate process:
    #   python run_livekit_agent.py dev
    # Embedding the agent inside uvicorn corrupts the async Redis pool on Windows.
    livekit_agent_embedded: bool = False

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
    completion_lock_ttl_seconds: int = 180
    transcript_merge_gap_ms: int = 1500
    transcript_merge_max_chars: int = 1200

    vpm_enabled: bool = True
    jd_fit_enabled: bool = True
    jd_fit_semantic_alignment_enabled: bool = True
    resume_builder_enabled: bool = False
    vpm_max_accepted_claims: int = 50
    vpm_max_raw_extract: int = 8
    vpm_pipeline_lease_seconds: int = 600
    vpm_verify_max_retries: int = 1
    vpm_verify_chunk_size: int = 5
    vpm_verify_gate_fallback: bool = True
    vpm_umbrella_terms: str = (
        "system design,leadership,communication,problem solving,teamwork,"
        "microservices,architecture,scalability,cloud,devops,agile,stakeholder management"
    )

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

    # Security
    trust_proxy_headers: bool = False
    trusted_proxy_ips: str = "127.0.0.1"
    compile_service_url: str = "http://127.0.0.1:8001"
    compile_service_token: str = ""
    tectonic_bin: str = "tectonic"
    resume_builder_compile_timeout_s: int = 30
    resume_builder_max_pdf_bytes: int = 2_097_152

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
        if value:
            return value
        # Dev fallback: allow any localhost / 127.0.0.1 port when explicit origins are set.
        if any("localhost" in o or "127.0.0.1" in o for o in self.allowed_origins_list()):
            return r"http://(localhost|127\.0\.0\.1)(:\d+)?"
        return None

    def _is_local_dev_origins(self) -> bool:
        return any("localhost" in o or "127.0.0.1" in o for o in self.allowed_origins_list())

    def expose_api_error_details(self) -> bool:
        """When True, 500 responses include exception type/message (local dev default)."""
        flag = os.getenv("EXPOSE_API_ERRORS", "").strip().lower()
        if flag in ("1", "true", "yes"):
            return True
        if flag in ("0", "false", "no"):
            return False
        return self._is_local_dev_origins()

    def require_email_verified(self) -> bool:
        """When True, API rejects tokens without email_verified claim."""
        flag = os.getenv("REQUIRE_EMAIL_VERIFIED", "").strip().lower()
        if flag in ("1", "true", "yes"):
            return True
        if flag in ("0", "false", "no"):
            return False
        return not self._is_local_dev_origins()

    def rate_limit_should_fail_open(self) -> bool:
        """When True, rate limits are skipped if Redis is unavailable (dev default)."""
        flag = os.getenv("RATE_LIMIT_FAIL_OPEN", "").strip().lower()
        if flag in ("1", "true", "yes"):
            return True
        if flag in ("0", "false", "no"):
            return False
        return self._is_local_dev_origins()

    def trusted_proxy_ips_list(self) -> List[str]:
        return [ip.strip() for ip in self.trusted_proxy_ips.split(",") if ip.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
