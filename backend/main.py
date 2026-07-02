import asyncio
import os
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from routes import contact, jd_fit, livekit, vault
from routes.interview import router as interview_router
from services.interview import InterviewService
from utils.cors import apply_cors_headers
from utils.http_errors import client_error_detail, json_error_content
from utils.logger import setup_logging, get_logger
from utils.redis_client import close_redis, test_connection

try:
    from livekit.agents import AgentServer
except Exception:
    AgentServer = None  # type: ignore[assignment, misc]

setup_logging()
log = get_logger(__name__)
settings = get_settings()

_agent_server: Optional[Any] = None
_agent_task: Optional[asyncio.Task] = None

_ACCESS_LOG_SKIP_PATHS = frozenset({"/health"})


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

    if (
        AgentServer is not None
        and settings.livekit_agent_embedded
        and settings.livekit_url
        and settings.livekit_api_key
        and settings.livekit_api_secret
    ):
        _start_agent_worker()
    elif (
        settings.livekit_url
        and settings.livekit_api_key
        and settings.livekit_api_secret
        and not settings.livekit_agent_embedded
    ):
        log.info(
            "LiveKit agent not embedded in API process — run separately: "
            "python run_livekit_agent.py dev"
        )

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

    tts_provider = (settings.tts_provider or "edge").lower()
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


def _cors_json_response(request: Request, status_code: int, detail: object) -> JSONResponse:
    response = JSONResponse(status_code=status_code, content=json_error_content(detail))
    apply_cors_headers(response, request.headers.get("origin") or "")
    return response


app = FastAPI(
    title="Vetta.ai AI Interviewer API",
    version="1.0.0",
    description="AI-powered technical interview platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list(),
    allow_origin_regex=settings.allowed_origin_regex_value(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return _cors_json_response(request, exc.status_code, exc.detail)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return _cors_json_response(request, exc.status_code, exc.detail)
    log.error("Unhandled API error on %s %s", request.method, request.url.path, exc_info=True)
    return _cors_json_response(
        request,
        500,
        client_error_detail("Internal server error", exc),
    )


@app.middleware("http")
async def access_log(request: Request, call_next):
    response = await call_next(request)
    if request.url.path not in _ACCESS_LOG_SKIP_PATHS:
        log.info("%s %s -> %s", request.method, request.url.path, response.status_code)
    return response


app.include_router(vault.router)
app.include_router(jd_fit.router)
app.include_router(livekit.router)
app.include_router(contact.router)
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
        "edge_tts": (settings.tts_provider or "edge").lower() == "edge",
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
