import json
import asyncio
from typing import Dict, Any
from datetime import datetime, timezone
from utils.logger import get_logger
from services.interview.llm_engine import LLMEngine
from models.interview import InterviewType

logger = get_logger("AnswerEvaluator")

class AnswerEvaluator:
    def __init__(self, engine:LLMEngine):
        self._engine = engine

    async def evaluate_answer(
        self,
        question_asked: str,
        candidate_answer: str,
        answer_duration: float,
        code_written: str = "",
    ) -> Dict[str, Any]:
        system_prompt = "You are evaluating a candidate's answer in a technical interview."
        user_prompt = f"""Question asked: {question_asked}
Candidate answered: {candidate_answer}
Answer duration: {answer_duration:.2f} seconds
Code written: {code_written or "none"}

Return JSON only, no other text:
{{
  "quality": "strong" | "adequate" | "weak" | "confused" | "no_answer",
  "completeness": 0.0 to 1.0,
  "what_was_good": "specific observation or null",
  "what_was_missing": "specific gap or null",
  "detected_misconception": "string or null",
  "confidence_signal": "high" | "medium" | "low",
  "recommended_action": "probe" | "challenge" | "advance" | "simplify" | "hint"
}}"""
        raw = "{}"
        eval_llm = self._engine.eval_llm
        fallback_llm = self._engine.fallback
        if hasattr(eval_llm, "json_completion"):
            try:
                raw = await asyncio.wait_for(
                    eval_llm.json_completion(system_prompt, user_prompt),
                    15.0,
                )
            except (asyncio.TimeoutError, Exception) as e:
                if self._engine._is_retryable_error(e) or isinstance(e, asyncio.TimeoutError):
                    logger.warning("Eval LLM failed, trying fallback: %s", e)
                if fallback_llm and fallback_llm is not eval_llm:
                    raw = await self._engine.generate_raw(
                        f"{system_prompt}\n\n{user_prompt}",
                        0.0,
                        llm=fallback_llm,
                        fallback_llm=None,
                        empty_fallback="{}",
                    )
        else:
            raw = await self._engine.generate_raw(
                f"{system_prompt}\n\n{user_prompt}",
                0.0,
                llm=eval_llm,
                fallback_llm=fallback_llm,
                empty_fallback="{}",
            )

        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            parsed = json.loads(raw[start:end])
        except Exception:
            logger.warning("Failed to parse evaluation payload: %s", raw)
            parsed = {}

        return {
            "quality": parsed.get("quality") or "adequate",
            "completeness": float(parsed.get("completeness") or 0.5),
            "what_was_good": parsed.get("what_was_good"),
            "what_was_missing": parsed.get("what_was_missing"),
            "detected_misconception": parsed.get("detected_misconception"),
            "confidence_signal": parsed.get("confidence_signal") or "medium",
            "recommended_action": parsed.get("recommended_action") or "probe",
        }

    async def analyze_response(
        self,
        question: str,
        candidate_response: str,
        interview_type: InterviewType
    ) -> Dict[str, Any]:
        """Analyze candidate's response"""
        prompt = f"""Analyze this interview response briefly:

Type: {interview_type.value}
Question: {question}
Response: {candidate_response}

Provide concise feedback in this format:
STRENGTHS:
- [key strength 1]
- [key strength 2]

AREAS TO IMPROVE:
- [improvement area 1]
- [improvement area 2]

SCORE: X/10"""

        analysis = await self._engine.generate(prompt, 0.3)

        return {
            'analysis': analysis,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
