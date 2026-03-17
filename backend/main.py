import asyncio
import os
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routes import resume, livekit
from routes.interview import router as interview_router
from utils.logger import setup_logging, get_logger
from utils.redis_client import test_connection, close_redis
from services.interview import InterviewService

try:
    from livekit.agents import AgentServer
except Exception:
    AgentServer = None  # type: ignore[assignment, misc]

setup_logging()
log = get_logger(__name__)
settings = get_settings()

_agent_server: Optional[Any] = None
_agent_task: Optional[asyncio.Task] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _agent_server, _agent_task

    log.info("Starting Vetta.ai AI Interviewer Platform")

    if await test_connection():
        log.info("Redis connected")
    else:
        log.warning("Redis connection failed — sessions will be unavailable")

    _log_service_status()

    try:
        _svc = InterviewService()
        log.info("LLM: %s model=%s", type(_svc.llm).__name__, getattr(_svc.llm, "model", None))
    except Exception as e:
        log.warning("LLM check failed: %s", e)

    if settings.use_agent_worker_v2 and settings.livekit_api_key:
        _start_agent_worker()

    yield

    log.info("Shutting down")

    if _agent_task and not _agent_task.done():
        _agent_task.cancel()
        try:
            await asyncio.wait_for(_agent_task, timeout=5.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass

    try:
        await close_redis()
    except Exception:
        pass

    log.info("Shutdown complete")


def _log_service_status() -> None:
    services = []
    try:
        provider = (settings.llm_provider or "groq").lower()
        if provider == "groq":
            services.append("Groq LLM" if settings.groq_api_key else "Groq LLM (missing key)")
        else:
            services.append("Gemini LLM" if settings.llm_api_key else "Gemini LLM (missing key)")
    except Exception:
        pass

    if settings.deepgram_api_key:
        services.append("Deepgram STT")
    if settings.judge0_api_key:
        services.append("Judge0 Code Execution")

    tts_provider = (getattr(settings, "tts_provider", "edge") or "edge").lower()
    if tts_provider == "edge":
        services.append("Edge TTS")
    elif settings.elevenlabs_api_key:
        services.append("ElevenLabs TTS")
    else:
        services.append("TTS (not configured)")

    if settings.livekit_api_key:
        services.append("LiveKit")

    log.info("Services: %s", ", ".join(services) if services else "none")


def _start_agent_worker() -> None:
    global _agent_server, _agent_task

    os.environ.setdefault("LIVEKIT_URL", settings.livekit_url)
    os.environ.setdefault("LIVEKIT_API_KEY", settings.livekit_api_key)
    os.environ.setdefault("LIVEKIT_API_SECRET", settings.livekit_api_secret)
    if settings.groq_api_key:
        os.environ.setdefault("GROQ_API_KEY", settings.groq_api_key)
    if settings.deepgram_api_key:
        os.environ.setdefault("DEEPGRAM_API_KEY", settings.deepgram_api_key)

    try:
        from services.interview.agent import server

        _agent_server = server
        _agent_task = asyncio.create_task(server.run(), name="livekit-agent-server")
        log.info("LiveKit Agent started")
    except Exception as e:
        log.warning("LiveKit Agent failed to start: %s", e)


app = FastAPI(
    title="Vetta.ai AI Interviewer API",
    version="1.0.0",
    description="AI-powered technical interview platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume.router)
app.include_router(livekit.router)
app.include_router(interview_router)


@app.get("/")
async def root():
    return {
        "message": "Vetta.ai AI Interviewer Platform v1.0.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    redis_ok = await test_connection()
    livekit_configured = bool(
        settings.livekit_api_key and settings.livekit_api_secret and settings.livekit_url
    )
    agent_running = _agent_task is not None and not _agent_task.done()

    try:
        from firebase_admin import _apps as firebase_apps  # type: ignore
        firebase_ok = bool(firebase_apps)
    except Exception:
        firebase_ok = False

    services = {
        "llm": bool(settings.llm_api_key or settings.groq_api_key),
        "deepgram": bool(settings.deepgram_api_key),
        "edge_tts": (getattr(settings, "tts_provider", "edge") or "edge").lower() == "edge",
        "elevenlabs": bool(settings.elevenlabs_api_key),
        "judge0": bool(settings.judge0_api_key),
        "redis": redis_ok,
        "firebase": firebase_ok,
        "livekit": livekit_configured,
        "agent": agent_running,
    }

    required = {k: v for k, v in services.items() if k not in {"elevenlabs", "judge0", "agent"}}
    overall = all(required.values())

    return {
        "status": "ok" if overall else "degraded",
        "version": "1.0.0",
        "services": services,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
