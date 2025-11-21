from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import resume, interview_session, websocket_interview_test, webrtc_offer_answer
from config import get_settings
from utils.logger import setup_logging, get_logger
from utils.redis_client import test_connection

setup_logging()
log = get_logger(__name__)
settings = get_settings()

app = FastAPI(
    title="AI Interviewer Platform API",
    version="2.0.0",
    description="Complete AI-powered interview platform with live transcription and code execution"
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
app.include_router(websocket_interview_test.router)
app.include_router(webrtc_offer_answer.router, prefix="/webrtc")


@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    log.info("🚀 Starting AI Interviewer Platform v2.0.0")
    
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
    if settings.google_cloud_api_key:
        services.append("✅ Google Cloud (STT/TTS)")
    
    log.info(f"Configured services: {', '.join(services) if services else 'None'}")


@app.get("/")
async def root():
    return {
        "message": "AI Interviewer Platform v2.0.0",
        "status": "operational",
        "features": [
            "📄 Resume parsing",
            "🎯 Custom role interviews",
            "💻 DSA with code execution",
            "🎤 Live transcription/subtitles",
            "📊 Comprehensive feedback",
            "⚡ Real-time WebSocket",
            "🔄 Multi-language support"
        ],
        "documentation": "/docs",
        "websocket": "/ws/interview/{session_id}"
    }


@app.get("/health")
async def health_check():
    """Enhanced health check"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "services": {
            "gemini_llm": bool(settings.llm_api_key),
            "judge0": bool(settings.judge0_api_key),
            "redis": True,
            "firebase": True
        },
        "features": {
            "dsa_interviews": True,
            "custom_roles": True,
            "live_transcription": True,
            "code_execution": bool(settings.judge0_api_key)
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
