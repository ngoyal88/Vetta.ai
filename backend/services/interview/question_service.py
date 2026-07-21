from utils.logger import get_logger
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from services.platform.llm import LLMEngine
from models.interview import InterviewType, DifficultyLevel
from services.interview.leetcode_service import DSA_EXCLUDE_TOPICS, LeetCodeService
from services.interview.problem_rewrite_service import rewrite_to_story, generate_starter_code
from services.interview.prompt_contracts import (
    execute_json_contract,
    normalize_question_payload,
)

logger = get_logger("QuestionService")


def _clean_question_text(value: Any, fallback: str) -> str:
    text = str(value or "").strip()
    return text if text else fallback


class QuestionService:
    def __init__(self, engine: LLMEngine):
        self._engine = engine
        self._lc = LeetCodeService()

    async def generate_first_question(
        self,
        interview_type: InterviewType,
        difficulty: DifficultyLevel,
        context: str,
        custom_role: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate contextual first question (context is pre-built by the facade)."""

        from services.interview.modes.registry import is_coding_interview_type

        if is_coding_interview_type(interview_type):
            q = await self._generate_dsa_question(difficulty, context)
            return {"question": q, "type": "coding", "timestamp": datetime.now(timezone.utc).isoformat()}
        if interview_type == InterviewType.ROLE_TARGETED:
            q = await self._generate_role_targeted_question(difficulty, context)
            return {"question": q, "type": "role_targeted", "timestamp": datetime.now(timezone.utc).isoformat()}
        q = await self._generate_general_question(interview_type, difficulty, context)
        return {"question": q, "type": interview_type.value, "timestamp": datetime.now(timezone.utc).isoformat()}

    async def generate_coding_question(
        self,
        *,
        track: str,
        difficulty: DifficultyLevel,
        context: str,
    ) -> Dict[str, Any]:
        """Track-aware coding question. DSA reuses the existing problem pipeline."""
        track_id = (track or "dsa").strip().lower() or "dsa"
        if track_id != "dsa":
            raise ValueError(f"Coding track '{track_id}' is not implemented")
        return await self._generate_dsa_question(difficulty, context)

    async def generate_resume_deep_dive_questions(
        self,
        *,
        difficulty: DifficultyLevel,
        context: str,
        probe_targets: list[Dict[str, Any]],
        count: int = 3,
    ) -> list[Dict[str, Any]]:
        selected_targets = [t for t in probe_targets if isinstance(t, dict)][: max(1, count)]
        if not selected_targets:
            fallback = await self._generate_general_question(InterviewType.RESUME_BASED, difficulty, context)
            return [{"question": fallback, "type": InterviewType.RESUME_BASED.value, "timestamp": datetime.now(timezone.utc).isoformat()}]

        target_blob_lines = []
        for target in selected_targets:
            target_blob_lines.append(
                f"- id={target.get('id')}; kind={target.get('kind')}; label={target.get('label')}; "
                f"detail={target.get('detail')}; resume_ref={target.get('resume_ref')}"
            )
        target_blob = "\n".join(target_blob_lines)
        prompt = f"""You are creating opening interview questions for a resume deep-dive session.
Difficulty: {difficulty.value}
Session context:
{context}

Probe targets (one question per target, keep order):
{target_blob}

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "probe_target_id": "target id",
      "resume_ref": "short quoted claim from resume",
      "question": "CV-anchored interview question",
      "evaluation_criteria": "What signals prove deep ownership and tradeoff awareness"
    }}
  ]
}}

Rules:
- Return exactly {len(selected_targets)} questions.
- Every question must point to a concrete role/project/achievement/weak area in probe targets.
- Avoid generic introductions such as \"tell me about yourself\".
"""
        contract = await execute_json_contract(
            template_id="first_question_resume_deep_dive",
            engine=self._engine,
            prompt=prompt,
            temperature=0.55,
            fallback={"questions": []},
            normalizer=lambda p: p if isinstance(p, dict) else {"questions": []},
            empty_fallback="{}",
        )
        parsed_obj = contract.value if isinstance(contract.value, dict) else {"questions": []}
        questions_value = parsed_obj.get("questions")
        parsed: list[Dict[str, Any]] = [q for q in questions_value if isinstance(q, dict)] if isinstance(questions_value, list) else []

        out: list[Dict[str, Any]] = []
        for idx, target in enumerate(selected_targets):
            generated = parsed[idx] if idx < len(parsed) else {}
            default_question = (
                f"Let's deep dive into {target.get('label')}. "
                f"Walk me through the constraints, your decisions, and measurable impact."
            )
            question_obj = {
                "type": InterviewType.RESUME_BASED.value,
                "question": _clean_question_text(generated.get("question"), default_question),
                "evaluation_criteria": _clean_question_text(
                    generated.get("evaluation_criteria"),
                    "Clear ownership, concrete tradeoffs, and measurable outcomes tied to the claim.",
                ),
                "difficulty": difficulty.value,
                "probe_target_id": str(generated.get("probe_target_id") or target.get("id") or f"target_{idx+1}"),
                "resume_ref": str(generated.get("resume_ref") or target.get("resume_ref") or target.get("label") or ""),
            }
            out.append(
                {
                    "question": question_obj,
                    "type": InterviewType.RESUME_BASED.value,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
        return out

    async def _generate_dsa_question(
        self,
        difficulty: DifficultyLevel,
        context: str
    ) -> Dict[str, Any]:
        """Fetch a real LeetCode problem and generate test cases via LLM.
        Falls back to LLM-generated problem if the LeetCode API is unavailable."""
        diff_map = {"easy": "Easy", "medium": "Medium", "hard": "Hard"}
        cap_diff = diff_map.get(difficulty.value, "Medium")
        try:
            raw = await self._lc.get_random_problem(cap_diff, exclude_topics=DSA_EXCLUDE_TOPICS)
            if raw is None:
                logger.warning("LeetCode returned only excluded (e.g. Database) problems, falling back to LLM")
                return await self._generate_dsa_question_llm(difficulty, context)
            question_data = self._lc.normalize(raw, difficulty.value)
        except Exception as e:
            logger.warning(f"LeetCode API failed ({e}), falling back to LLM question generation")
            return await self._generate_dsa_question_llm(difficulty, context)

        # Rewrite to story (anti-cheat); keeps _original_* for test generation
        question_data = await rewrite_to_story(question_data)
        question_data = await self._generate_test_cases(question_data)
        question_data["starter_code"] = generate_starter_code(question_data)
        logger.info(f"✅ DSA question from LeetCode: {question_data.get('title')}")
        return question_data

    async def _generate_test_cases(self, question_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate 2 visible + 9 hidden test cases. Uses ORIGINAL problem semantics and canonical I/O format."""
        # Use original (pre-rewrite) title/description so test cases match the real problem
        title = question_data.get("_original_title") or question_data.get("title", "")
        description = (question_data.get("_original_description") or question_data.get("description", ""))[:2000]
        sig = question_data.get("function_signature") or {}
        param_count = len(sig.get("params") or [])
        if param_count == 0:
            param_count = 2  # e.g. nums, target

        prompt = f"""You are generating test cases for a coding problem. Use the ORIGINAL problem semantics below.

Problem: {title}
Description: {description}

CANONICAL FORMAT (required):
- "input": exactly {param_count} lines, each line is valid JSON for one function parameter in order (e.g. first line = first param, second line = second param). Use newline between lines (\\n in JSON string).
- "output": exactly one line, valid JSON for the return value (e.g. "[0,1]" for list of indices).

Example for a two-param function: "input": "[2,7,11,15]\\n9", "output": "[0,1]"

Return ONLY valid JSON (no markdown, no backticks):
{{
  "visible": [
    {{"input": "<{param_count} JSON lines separated by \\n>", "output": "<single JSON line>"}},
    {{"input": "<...>", "output": "<...>"}}
  ],
  "hidden": [
    {{"input": "<...>", "output": "<...>"}},
    {{"input": "<...>", "output": "<...>"}},
    {{"input": "<...>", "output": "<...>"}},
    {{"input": "<...>", "output": "<...>"}},
    {{"input": "<...>", "output": "<...>"}},
    {{"input": "<...>", "output": "<...>"}},
    {{"input": "<...>", "output": "<...>"}},
    {{"input": "<...>", "output": "<...>"}},
    {{"input": "<...>", "output": "<...>"}}
  ]
}}

Rules:
- visible: 2 simple examples; hidden: 9 covering edge cases (empty, single element, max constraints, etc.)
- Every "input" must be {param_count} JSON lines joined by newline. Every "output" must be one JSON line.
- All inputs/outputs must be correct for the problem above."""

        contract = await execute_json_contract(
            template_id="first_question_dsa_testcases",
            engine=self._engine,
            prompt=prompt,
            temperature=0.3,
            fallback={"visible": [], "hidden": []},
            normalizer=lambda p: p if isinstance(p, dict) else {"visible": [], "hidden": []},
            empty_fallback="{}",
        )
        try:
            data = contract.value if isinstance(contract.value, dict) else {"visible": [], "hidden": []}
            visible = data.get("visible") or []
            hidden = data.get("hidden") or []

            test_cases = []
            for tc in visible[:2]:
                if isinstance(tc, dict) and tc.get("input") is not None:
                    test_cases.append({
                        "input": str(tc["input"]),
                        "output": str(tc.get("output", "")),
                        "is_hidden": False,
                    })
            for tc in hidden[:9]:
                if isinstance(tc, dict) and tc.get("input") is not None:
                    test_cases.append({
                        "input": str(tc["input"]),
                        "output": str(tc.get("output", "")),
                        "is_hidden": True,
                    })

            question_data["test_cases"] = test_cases
            if visible:
                question_data["examples"] = [
                    {"input": v["input"], "output": v.get("output", ""), "explanation": ""}
                    for v in visible[:2] if isinstance(v, dict)
                ]
                if question_data["examples"]:
                    question_data["example"] = question_data["examples"][0]
        except Exception as e:
            logger.error(f"Failed to generate test cases: {e}", exc_info=True)
            question_data["test_cases"] = [
                {"input": "", "output": "", "is_hidden": False},
                {"input": "", "output": "", "is_hidden": False},
            ]
        return question_data

    async def _generate_dsa_question_llm(
        self,
        difficulty: DifficultyLevel,
        context: str
    ) -> Dict[str, Any]:
        """Fallback: generate DSA coding question entirely via LLM."""
        import uuid

        prompt = f"""Generate a {difficulty.value} difficulty DSA problem suitable for a coding interview.

Context: {context}

Return ONLY valid JSON (no markdown, no backticks, no explanation):
{{
    "title": "Problem title",
    "description": "Detailed problem description with examples",
    "input_format": "Description of input",
    "output_format": "Description of output",
    "constraints": ["constraint1", "constraint2"],
    "example": {{
        "input": "example input",
        "output": "example output",
        "explanation": "why this output"
    }},
    "test_cases": [
        {{"input": "test1_input", "output": "test1_output", "is_hidden": false}},
        {{"input": "test2_input", "output": "test2_output", "is_hidden": false}},
        {{"input": "test3_input", "output": "test3_output", "is_hidden": true}},
        {{"input": "test4_input", "output": "test4_output", "is_hidden": true}},
        {{"input": "test5_input", "output": "test5_output", "is_hidden": true}}
    ],
    "hints": ["hint1", "hint2"],
    "time_complexity_expected": "O(n)",
    "space_complexity_expected": "O(1)",
    "starter_code": {{
        "python": "# Write your solution here\\n",
        "javascript": "// Write your solution here\\n"
    }}
}}
Rules: first 2 test_cases must have is_hidden=false (visible), rest is_hidden=true (hidden).
starter_code is optional."""

        contract = await execute_json_contract(
            template_id="first_question_dsa_llm",
            engine=self._engine,
            prompt=prompt,
            temperature=0.7,
            fallback={},
            normalizer=lambda p: p if isinstance(p, dict) else {},
            empty_fallback="{}",
        )

        try:
            question_data = contract.value if isinstance(contract.value, dict) else {}

            question_data['question_id'] = str(uuid.uuid4())
            question_data['type'] = 'coding'
            question_data['difficulty'] = difficulty.value
            if not question_data.get('starter_code'):
                question_data['starter_code'] = {}
            if 'example' in question_data and not question_data.get('examples'):
                question_data['examples'] = [question_data['example']]
            # Ensure is_hidden field on all test cases
            for i, tc in enumerate(question_data.get('test_cases', [])):
                if isinstance(tc, dict) and 'is_hidden' not in tc:
                    tc['is_hidden'] = i >= 2
            # Function-only: set default signature and generate boilerplate
            from services.interview.problem_rewrite_service import DEFAULT_FUNCTION_SIGNATURE
            if not question_data.get('function_signature'):
                question_data['function_signature'] = DEFAULT_FUNCTION_SIGNATURE
            question_data['starter_code'] = generate_starter_code(question_data)

            logger.info(f"✅ Generated DSA question via LLM: {question_data.get('title')}")
            return question_data

        except Exception as e:
            logger.error(f"❌ Failed to parse DSA question JSON: {e}", exc_info=True)
            return self._get_fallback_dsa_question(difficulty)

    async def _generate_role_targeted_question(
        self,
        difficulty: DifficultyLevel,
        context: str,
    ) -> Dict[str, Any]:
        focus_hint = (
            "Prioritize behavioral scenarios, ownership, and collaboration signals from the JD."
            if "Interview Focus: behavioral" in context
            else "Prioritize system design tradeoffs, scalability, and architecture decisions from the JD."
            if "Interview Focus: system design" in context
            else "Prioritize an algorithmic or data-structure problem suitable for a spoken interview "
            "(describe the problem clearly; do not require an IDE)."
            if "Interview Focus: dsa" in context
            else "Prioritize hands-on technical depth tied to stack/tools named in the JD."
            if "Interview Focus: technical" in context
            else "Balance technical depth and behavioral signals according to the JD and probing areas."
        )
        prompt = f"""You are starting a job-specific interview.
Difficulty: {difficulty.value}
{context}

Generate ONE opening interview question. It must be specific to the target role (and company, if given) and should probe either a candidate strength or likely gap.
{focus_hint}

Return ONLY valid JSON:
{{
    "question": "Your question here",
    "evaluation_criteria": "What to look for in a strong answer"
}}"""
        contract = await execute_json_contract(
            template_id="first_question_role_targeted",
            engine=self._engine,
            prompt=prompt,
            temperature=0.65,
            fallback=normalize_question_payload({}, fallback_question="What project best shows your fit for this role, and what tradeoffs did you make?", difficulty=difficulty, q_type="role_targeted"),
            normalizer=lambda p: normalize_question_payload(
                p,
                fallback_question="What project best shows your fit for this role, and what tradeoffs did you make?",
                difficulty=difficulty,
                q_type="role_targeted",
            ),
            empty_fallback="{}",
        )
        return contract.value

    async def _generate_general_question(
        self,
        interview_type: InterviewType,
        difficulty: DifficultyLevel,
        context: str
    ) -> Dict[str, Any]:
        """Generate general technical/behavioral question"""
        type_prompts = {
            InterviewType.RESUME_BASED: f"their resume and experience{context}",
        }

        topic = type_prompts.get(interview_type, "software engineering")

        prompt = f"""Generate a {difficulty.value} difficulty question about {topic}.
{context}

Make it conversational and specific. Return ONLY valid JSON:
{{
    "question": "The question text",
    "evaluation_criteria": "What to look for in a good answer"
}}"""

        contract = await execute_json_contract(
            template_id="first_question_general",
            engine=self._engine,
            prompt=prompt,
            temperature=0.7,
            fallback=normalize_question_payload({}, fallback_question=f"Walk me through a practical {topic} problem you solved recently.", difficulty=difficulty, q_type=interview_type.value),
            normalizer=lambda p: normalize_question_payload(
                p,
                fallback_question=f"Walk me through a practical {topic} problem you solved recently.",
                difficulty=difficulty,
                q_type=interview_type.value,
            ),
            empty_fallback="{}",
        )
        return contract.value

    def _get_fallback_dsa_question(self, difficulty: DifficultyLevel) -> Dict[str, Any]:
        """Fallback DSA question if generation fails. Uses canonical I/O and function-only boilerplate."""
        import uuid
        from services.interview.problem_rewrite_service import DEFAULT_FUNCTION_SIGNATURE

        q = {
            "question_id": str(uuid.uuid4()),
            "title": "Two Sum",
            "description": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.\n\nYou may assume each input has exactly one solution, and you may not use the same element twice.",
            "input_format": "nums = [2,7,11,15], target = 9",
            "output_format": "[0,1]",
            "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
            "example": {
                "input": "[2,7,11,15]\n9",
                "output": "[0,1]",
                "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."
            },
            "test_cases": [
                {"input": "[2,7,11,15]\n9", "output": "[0,1]", "is_hidden": False},
                {"input": "[3,2,4]\n6", "output": "[1,2]", "is_hidden": False},
                {"input": "[3,3]\n6", "output": "[0,1]", "is_hidden": True}
            ],
            "hints": [
                "Use a hash map to store values you've seen",
                "For each number, check if target - number exists in the map"
            ],
            "function_signature": DEFAULT_FUNCTION_SIGNATURE,
            "examples": [
                {"input": "[2,7,11,15]\n9", "output": "[0,1]", "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."}
            ],
            "type": "coding",
            "difficulty": difficulty.value
        }
        q["starter_code"] = generate_starter_code(q)
        return q
