from typing import Dict, Any
from utils.logger import get_logger
from services.interview.llm_engine import LLMEngine
from services.interview.prompt_contracts import (
    execute_json_contract,
    normalize_answer_evaluation,
)

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
        prompt = f"""You are evaluating a candidate's answer in a technical interview.

Question asked: {question_asked}
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
        result = await execute_json_contract(
            template_id="answer_evaluation",
            engine=self._engine,
            prompt=prompt,
            temperature=0.0,
            fallback=normalize_answer_evaluation({}),
            normalizer=normalize_answer_evaluation,
            empty_fallback="{}",
        )
        if not result.ok:
            logger.warning("answer_evaluation contract fallback used")
        return result.value
