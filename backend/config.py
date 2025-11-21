# ========================================
# 1. UPDATED config.py - Clean configuration
# ========================================

import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---------- LLM Configuration (Gemini) ----------------------------- #
    llm_api_key: str = ""
    llm_model: str = "gemini-2.5-flash"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 6000

    # ---------- Speech Services (Free tier options) -------------------- #
    # For TTS: Can use Google Cloud TTS free tier or pyttsx3 (offline)
    # For STT: Can use Google Cloud Speech free tier or whisper.cpp (offline)
    google_cloud_api_key: str = ""
    
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
    api_token: str = os.getenv("API_TOKEN","")
    jwt_secret_key: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    
    # ---------- CORS --------------------------------------------------- #
    allowed_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:5174"
    
    # ---------- Interview Settings ------------------------------------- #
    max_interview_duration_minutes: int = 60
    max_questions_per_interview: int = 15
    dsa_time_limit_minutes: int = 45
    
    # ---------- Logging ------------------------------------------------ #
    log_level: str = "INFO"
    log_format: str = "console"
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()