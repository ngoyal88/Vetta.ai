# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import resume, interview_session, websocket_routes
from config import get_settings
from utils.logger import setup_logging, get_logger
from utils.redis_client import test_connection

setup_logging()
log = get_logger(__name__)
settings = get_settings()

app = FastAPI(
    title="AI Interviewer Platform API",
    version="4.0.0",
    description="AI-powered interview platform with WebSocket + Deepgram + ElevenLabs"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(resume.router)
app.include_router(interview_session.router)
app.include_router(websocket_routes.router)  # NEW: WebSocket routes


@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    log.info("🚀 Starting AI Interviewer Platform v4.0.0 (WebSocket + Deepgram + ElevenLabs)")
    
    # Test Redis
    redis_ok = await test_connection()
    if redis_ok:
        log.info("✅ Redis connected")
    else:
        log.warning("⚠️ Redis connection failed")
    
    # Log configured services
    services = []
    if settings.llm_api_key:
        services.append("✅ Gemini LLM")
    if settings.judge0_api_key:
        services.append("✅ Judge0 Code Execution")
    if settings.deepgram_api_key:
        services.append("✅ Deepgram STT")
    if settings.elevenlabs_api_key:
        services.append("✅ ElevenLabs TTS")
    
    log.info(f"Services: {', '.join(services) if services else 'None'}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    log.info("🛑 Shutting down...")
    log.info("✅ Shutdown complete")


@app.get("/")
async def root():
    return {
        "message": "AI Interviewer Platform v4.0.0",
        "status": "operational",
        "architecture": "WebSocket + Deepgram STT + ElevenLabs TTS + Gemini AI",
        "features": [
            "📄 Resume parsing",
            "🎯 Custom role interviews",
            "💻 DSA with code execution",
            "🎤 Real-time voice (Deepgram + ElevenLabs)",
            "🤖 AI interviewer (Gemini)",
            "📊 Comprehensive feedback"
        ],
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "version": "4.0.0",
        "services": {
            "gemini": bool(settings.llm_api_key),
            "deepgram": bool(settings.deepgram_api_key),
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