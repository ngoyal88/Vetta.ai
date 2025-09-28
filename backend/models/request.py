from pydantic import BaseModel, Field
from typing import Optional, List

class InterviewStartRequest(BaseModel):
    user: str = Field(..., min_length=1, example="testuser")
    interview_type: str = Field(..., min_length=1, example="dsa")
    difficulty: Optional[str] = Field(None, description="easy|medium|hard")
    tags: Optional[List[str]] = Field(None, description="optional list of tags")

class AnswerSubmitRequest(BaseModel):
    question_index: int = Field(..., ge=0, example=0)
    answer: str = Field(..., min_length=1, example="This is my answer")
