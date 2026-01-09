from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import resume, interview_session, websocket_routes
from config import get_settings
from utils.logger import setup_logging, get_logger
from utils.redis_client import test_connection
from services.interview_service import InterviewService

setup_logging()
log = get_logger(__name__)
settings = get_settings()

app = FastAPI(
    title="AI Interviewer Platform API",
    version="5.0.0",
    description="AI-powered interview platform (WebSocket voice MVP)"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(resume.router)
app.include_router(interview_session.router)
app.include_router(websocket_routes.router)

@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    log.info("🚀 Starting AI Interviewer Platform v5.0.0 (WebSocket MVP)")
    
    # Test Redis
    redis_ok = await test_connection()
    if redis_ok:
        log.info("✅ Redis connected")
    else:
        log.warning("⚠️ Redis connection failed")
    
    # Log configured services
    services = []
    # LLM provider summary
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
    # TTS provider: Edge by default (no key required).
    # Switch back later by setting TTS_PROVIDER=elevenlabs and providing ELEVENLABS_API_KEY.
    if (getattr(settings, "tts_provider", "edge") or "edge").lower() == "edge":
        services.append("✅ Edge TTS")
    elif settings.elevenlabs_api_key:
        services.append("✅ ElevenLabs TTS")
    else:
        services.append("⚠️ TTS (not configured)")
    
    log.info(f"Services: {', '.join(services) if services else 'None'}")

    # LLM selection diagnostic
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
    log.info("✅ Shutdown complete")


@app.get("/")
async def root():
    return {
        "message": "AI Interviewer Platform v5.0.0",
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
    """Health check"""
    return {
        "status": "healthy",
        "version": "5.0.0",
        "services": {
            "gemini": bool(settings.llm_api_key),
            "deepgram": bool(settings.deepgram_api_key),
            "edge_tts": (getattr(settings, "tts_provider", "edge") or "edge").lower() == "edge",
            # Switch-back note: set TTS_PROVIDER=elevenlabs
            "elevenlabs": bool(settings.elevenlabs_api_key),
            "judge0": bool(settings.judge0_api_key),
            "redis": True,
            "firebase": True
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
