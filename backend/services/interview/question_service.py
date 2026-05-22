import json
from utils.logger import get_logger
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from services.interview.llm_engine import LLMEngine
from models.interview import InterviewType, DifficultyLevel
from services.interview.leetcode_service import DSA_EXCLUDE_TOPICS, LeetCodeService
from services.interview.problem_rewrite_service import rewrite_to_story, generate_starter_code

logger = get_logger("QuestionService")


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

        if interview_type == InterviewType.DSA:
            q = await self._generate_dsa_question(difficulty, context)
            return {"question": q, "type": "coding", "timestamp": datetime.now(timezone.utc).isoformat()}
        elif interview_type == InterviewType.CUSTOM:
            q = await self._generate_custom_role_question(custom_role, difficulty, context)
            return {"question": q, "type": "custom_role", "timestamp": datetime.now(timezone.utc).isoformat()}
        elif interview_type == InterviewType.ROLE_TARGETED:
            q = await self._generate_role_targeted_question(difficulty, context)
            return {"question": q, "type": "role_targeted", "timestamp": datetime.now(timezone.utc).isoformat()}
        else:
            q = await self._generate_general_question(interview_type, difficulty, context)
            return {"question": q, "type": interview_type.value, "timestamp": datetime.now(timezone.utc).isoformat()}

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

        response = await self._engine.generate_raw(prompt, 0.3, empty_fallback="{}")
        try:
            resp = response.strip().strip('`').strip()
            if resp.lower().startswith('json'):
                resp = resp[4:]
            data = json.loads(resp[resp.find('{'):resp.rfind('}') + 1])
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

        response = await self._engine.generate_raw(prompt, 0.7, empty_fallback="{}")

        try:
            resp = response.strip().strip('`').strip()
            if resp.lower().startswith('json'):
                resp = resp[4:]
            json_start = resp.find('{')
            json_end = resp.rfind('}') + 1
            json_str = resp[json_start:json_end]
            question_data = json.loads(json_str)

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

    async def _generate_custom_role_question(
        self,
        role: str,
        difficulty: DifficultyLevel,
        context: str
    ) -> Dict[str, Any]:
        """Generate question for custom role"""
        prompt = f"""You are interviewing for: {role}
Difficulty: {difficulty.value}
{context}

Generate ONE technical question for this role. Make it specific and relevant.

Return ONLY valid JSON:
{{
    "question": "Your question here",
    "evaluation_criteria": "Key points to look for in the answer"
}}"""

        response = await self._engine.generate_raw(prompt, 0.7, empty_fallback="{}")

        try:
            resp = response.strip().strip('`').strip()
            if resp.lower().startswith('json'):
                resp = resp[4:]
            start = resp.find('{')
            end = resp.rfind('}') + 1
            obj = json.loads(resp[start:end])

            return {
                'type': 'custom_role',
                'role': role,
                'question': obj.get('question', response),
                'evaluation_criteria': obj.get('evaluation_criteria', ''),
                'difficulty': difficulty.value
            }
        except Exception:
            return {
                'type': 'custom_role',
                'role': role,
                'question': response,
                'evaluation_criteria': '',
                'difficulty': difficulty.value
            }

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
        response = await self._engine.generate_raw(prompt, 0.65, empty_fallback="{}")
        try:
            resp = response.strip().strip('`').strip()
            if resp.lower().startswith('json'):
                resp = resp[4:]
            start = resp.find('{')
            end = resp.rfind('}') + 1
            obj = json.loads(resp[start:end])
            return {
                "type": "role_targeted",
                "question": obj.get("question", response),
                "evaluation_criteria": obj.get("evaluation_criteria", ""),
                "difficulty": difficulty.value,
            }
        except Exception:
            return {
                "type": "role_targeted",
                "question": response,
                "evaluation_criteria": "",
                "difficulty": difficulty.value,
            }

    async def _generate_general_question(
        self,
        interview_type: InterviewType,
        difficulty: DifficultyLevel,
        context: str
    ) -> Dict[str, Any]:
        """Generate general technical/behavioral question"""
        type_prompts = {
            InterviewType.FRONTEND: "frontend development (React, JavaScript, CSS, performance)",
            InterviewType.BACKEND: "backend development (APIs, databases, scalability)",
            InterviewType.CORE_CS: "computer science fundamentals (OS, Networks, DBMS)",
            InterviewType.BEHAVIORAL: "behavioral scenarios (teamwork, problem-solving, conflict resolution)",
            InterviewType.RESUME_BASED: f"their resume and experience{context}"
        }

        topic = type_prompts.get(interview_type, "software engineering")

        prompt = f"""Generate a {difficulty.value} difficulty question about {topic}.
{context}

Make it conversational and specific. Return ONLY valid JSON:
{{
    "question": "The question text",
    "evaluation_criteria": "What to look for in a good answer"
}}"""

        response = await self._engine.generate_raw(prompt, 0.7, empty_fallback="{}")

        try:
            resp = response.strip().strip('`').strip()
            if resp.lower().startswith('json'):
                resp = resp[4:]
            start = resp.find('{')
            end = resp.rfind('}') + 1
            obj = json.loads(resp[start:end])

            return {
                'type': interview_type.value,
                'question': obj.get('question', response),
                'evaluation_criteria': obj.get('evaluation_criteria', ''),
                'difficulty': difficulty.value
            }
        except Exception:
            return {
                'type': interview_type.value,
                'question': response,
                'evaluation_criteria': '',
                'difficulty': difficulty.value
            }

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
