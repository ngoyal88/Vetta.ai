from fastapi import APIRouter

from config import get_settings
from services.interview import InterviewService, CodeExecutionService
from utils.logger import get_logger

router = APIRouter(prefix="/interview", tags=["Interview"])

logger = get_logger("InterviewRoutes")
settings = get_settings()

interview_service = InterviewService()
code_service = CodeExecutionService()

SESSION_TTL = getattr(settings, "interview_session_ttl_seconds", 7200)

# Import submodules so their route handlers are registered on `router`
from . import start, complete, code, history, account  # noqa: F401,E402

