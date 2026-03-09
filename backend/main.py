from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import resume, websocket_routes
from services.interview import InterviewService
from routes.interview import router as interview_router
from config import get_settings
from utils.logger import setup_logging, get_logger
from utils.redis_client import test_connection, close_redis
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

setup_logging()
log = get_logger(__name__)
settings = get_settings()

if getattr(settings, "sentry_dsn", ""):
    sentry_logging = LoggingIntegration(
        level="INFO",
        event_level="ERROR",
    )
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[
            FastApiIntegration(),
            sentry_logging,
        ],
        traces_sample_rate=0.0,
        profiles_sample_rate=0.0,
    )

app = FastAPI(
    title="AI Interviewer Platform API",
    version="1.0.0",
    description="AI-powered interview platform (WebSocket voice MVP)"
)

# CORS: from ALLOWED_ORIGINS env. In production, set it explicitly (include your frontend URL).
_origins = settings.allowed_origins_list()
if not _origins:
    _origins = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=settings.allowed_origin_regex_value(),
)

app.include_router(resume.router)
app.include_router(interview_router)
app.include_router(websocket_routes.router)
app.include_router(websocket_routes.legacy_router)

@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    log.info("🚀 Starting AI Interviewer Platform v1.0.0 (WebSocket MVP)")
    
    redis_ok = await test_connection()
    if redis_ok:
        log.info("✅ Redis connected")
    else:
        log.warning("⚠️ Redis connection failed")
    
    services = []
    try:
        if (settings.llm_provider or "gemini").lower() == "groq":
            services.append("✅ Groq LLM" if settings.groq_api_key else "⚠️ Groq LLM (missing key)")
        else:
            services.append("✅ Gemini LLM" if settings.llm_api_key else "⚠️ Gemini LLM (missing key)")
    except Exception:
        pass
    if settings.judge0_api_key:
        services.append("✅ Judge0 Code Execution")
    if settings.deepgram_api_key:
        services.append("✅ Deepgram STT")
    if (getattr(settings, "tts_provider", "edge") or "edge").lower() == "edge":
        services.append("✅ Edge TTS")
    elif settings.elevenlabs_api_key:
        services.append("✅ ElevenLabs TTS")
    else:
        services.append("⚠️ TTS (not configured)")
    
    log.info(f"Services: {', '.join(services) if services else 'None'}")

    try:
        _svc = InterviewService()
        log.info(
            f"LLM selected: {type(_svc.llm).__name__} model={getattr(_svc.llm, 'model', None)}"
        )
    except Exception as e:
        log.warning(f"LLM selection check failed: {e}")



@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    log.info("🛑 Shutting down...")
    try:
        await close_redis()
    except Exception:
        pass
    log.info("✅ Shutdown complete")


@app.get("/")
async def root():
    return {
        "message": "AI Interviewer Platform v1.0.0",
        "status": "operational",
        "architecture": "WebSocket + Deepgram STT + Edge TTS + LLM",
        "features": [
            "📄 Resume parsing",
            "🎯 Custom role interviews",
            "💻 DSA with code execution",
            "🎤 Real-time voice (WebSocket)",
            "🤖 AI interviewer (LLM)",
            "📊 Comprehensive feedback"
        ],
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check with lightweight dependency probes."""
    redis_ok = await test_connection()
    deepgram_configured = bool(settings.deepgram_api_key)
    judge0_configured = bool(settings.judge0_api_key)
    llm_configured = bool(settings.llm_api_key or settings.groq_api_key)
    tts_edge = (getattr(settings, "tts_provider", "edge") or "edge").lower() == "edge"
    eleven_configured = bool(settings.elevenlabs_api_key)
    livekit_configured = bool(settings.livekit_api_key and settings.livekit_api_secret)

    try:
        from firebase_admin import _apps as firebase_apps  # type: ignore
        firebase_ok = bool(firebase_apps)
    except Exception:
        firebase_ok = False

    services = {
        "llm": llm_configured,
        "deepgram": deepgram_configured,
        "edge_tts": tts_edge,
        "elevenlabs": eleven_configured,
        "judge0": judge0_configured,
        "redis": redis_ok,
        "firebase": firebase_ok,
        "livekit": livekit_configured,
    }

    overall = all(services.values())

    return {
        "status": "ok" if overall else "degraded",
        "version": "1.0.0",
        "services": services,
    }


@app.get("/health/ready")
async def readiness_check():
    """Readiness: Redis only. Use for k8s/orchestrator to know the app can serve traffic."""
    redis_ok = await test_connection()
    return {"ready": redis_ok, "redis": redis_ok}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
