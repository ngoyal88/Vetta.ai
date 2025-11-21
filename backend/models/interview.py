
# ========================================
# 2. models/interview.py - Enhanced models
# ========================================

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from enum import Enum


class InterviewType(str, Enum):
    DSA = "dsa"
    FRONTEND = "frontend"
    BACKEND = "backend"
    CORE_CS = "core"
    BEHAVIORAL = "behavioral"
    RESUME_BASED = "resume"
    CUSTOM = "custom"  # New: Custom role


class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class QuestionType(str, Enum):
    CODING = "coding"
    THEORY = "theory"
    BEHAVIORAL = "behavioral"
    SYSTEM_DESIGN = "system_design"


class TestCase(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = False


class CodingQuestion(BaseModel):
    question_id: str
    title: str
    description: str
    difficulty: DifficultyLevel
    test_cases: List[TestCase]
    constraints: List[str] = []
    hints: List[str] = []
    starter_code: Dict[str, str] = {}  # language: code


class CodeSubmission(BaseModel):
    session_id: str
    question_id: str
    language: str
    code: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CodeExecutionResult(BaseModel):
    passed_tests: int
    total_tests: int
    execution_time: float
    memory_used: float
    passed: bool
    error_message: Optional[str] = None
    test_results: List[Dict[str, Any]] = []


class InterviewSession(BaseModel):
    session_id: str
    user_id: str
    interview_type: InterviewType
    custom_role: Optional[str] = None  # For custom interviews
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    status: str = "active"  # active, paused, completed
    current_question_index: int = 0
    questions: List[Dict[str, Any]] = []
    responses: List[Dict[str, Any]] = []
    code_submissions: List[CodeSubmission] = []
    live_transcription: List[Dict[str, str]] = []  # New: For subtitles
    resume_data: Dict[str, Any] = {}
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


class TranscriptionEntry(BaseModel):
    speaker: str  # "candidate" or "interviewer"
    text: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    language: str = "en"
