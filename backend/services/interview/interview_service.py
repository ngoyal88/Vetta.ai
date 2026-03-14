# services/interview_service.py
import asyncio
import json
from typing import AsyncGenerator, Dict, List, Optional, Any, Union
from datetime import datetime, timezone
from services.integrations import GeminiService, GroqService
from services.interview.leetcode_service import DSA_EXCLUDE_TOPICS, LeetCodeService
from services.interview.problem_rewrite_service import rewrite_to_story, generate_starter_code
from config import get_settings
from models.interview import InterviewType, DifficultyLevel
from utils.logger import get_logger
from utils.redis_client import get_session, update_session
from utils.response_validator import process_response

_lc = LeetCodeService()

logger = get_logger("InterviewService")
SESSION_TTL = getattr(get_settings(), "interview_session_ttl_seconds", 7200)


def _parse_interview_type(val: Optional[str]) -> InterviewType:
    """Robustly parse InterviewType from string (case-insensitive; supports name or value)."""
    if not val:
        return InterviewType.DSA
    # direct try
    try:
        return InterviewType(val)
    except Exception:
        pass
    # try by name ignoring case
    v = val.strip().lower()
    for it in InterviewType:
        try:
            if it.name.lower() == v or str(it.value).lower() == v:
                return it
        except Exception:
            continue
    logger.warning(f"Unknown InterviewType '{val}', defaulting to DSA")
    return InterviewType.DSA


def _normalize_question_entry(q: Union[str, Dict], default_type: str = "behavioral") -> Dict:
    """
    Ensure every questions[] entry has a consistent dict shape:
    {
      "question": { ... } or "question": "plain text",
      "type": "<type string>",
      "timestamp": ...
    }
    """
    if isinstance(q, dict):
        # If the dict already seems like a question object, keep it
        if "question" in q or "title" in q or "description" in q:
            # keep as-is but ensure top-level 'type' and 'timestamp' if missing
            out = q.copy()
            if "type" not in out:
                out["type"] = default_type
            return out
        else:
            # assume it's already a wrapped entry (question object)
            return {
                "question": q,
                "type": q.get("type", default_type),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    else:
        # plain string -> wrap
        return {
            "question": {"question": str(q)},
            "type": default_type,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


def _extract_question_text(q_entry: Union[str, Dict]) -> str:
    """Return a human-readable question text given an entry that may be string or dict."""
    if isinstance(q_entry, str):
        return q_entry
    if isinstance(q_entry, dict):
        # q_entry might be a wrapped entry {'question': {...}, 'type': '...'} or a plain question dict
        q = q_entry.get("question") if "question" in q_entry else q_entry
        if isinstance(q, dict):
            # prefer 'question' field, fallback to 'title' or full JSON string
            return q.get("question") or q.get("title") or json.dumps(q)
        elif isinstance(q, str):
            return q
    return str(q_entry)


class InterviewService:
    def __init__(self):
        settings = get_settings()
        provider = (settings.llm_provider or "").lower()
        logger.info(
            f"LLM config: provider={provider or '<unset>'} groq_key={'yes' if settings.groq_api_key else 'no'} gemini_key={'yes' if settings.llm_api_key else 'no'}"
        )

        if provider == "groq":
            if settings.groq_api_key:
                logger.info("Using Groq LLM provider")
                self.llm = GroqService()
            else:
                logger.warning("groq selected but GROQ_API_KEY missing; falling back to Gemini")
                self.llm = GeminiService()
        elif provider == "gemini":
            # If Gemini is selected but its key is missing, auto-fallback to Groq when available
            if settings.llm_api_key:
                self.llm = GeminiService()
            elif settings.groq_api_key:
                logger.info("Gemini selected but key missing; auto-falling back to Groq")
                self.llm = GroqService()
            else:
                logger.warning("No LLM keys configured; Gemini client will be unconfigured")
                self.llm = GeminiService()
        else:
            # Provider unset or unknown: prefer Groq if available, else Gemini
            if settings.groq_api_key:
                logger.info("LLM provider unset/unknown; preferring Groq (key present)")
                self.llm = GroqService()
            else:
                logger.info("LLM provider unset/unknown; using Gemini")
                self.llm = GeminiService()
        self.eval_llm = GroqService() if settings.groq_api_key else self.llm

        self._fallback_llm = None
        if provider == "groq" and getattr(settings, "llm_api_key", None):
            self._fallback_llm = GeminiService()
        elif provider == "gemini" and getattr(settings, "groq_api_key", None):
            self._fallback_llm = GroqService()
        elif not provider or provider not in ("groq", "gemini"):
            if settings.groq_api_key and settings.llm_api_key:
                self._fallback_llm = GeminiService() if self.llm.__class__.__name__ == "GroqService" else GroqService()

    def _is_retryable_error(self, e: Exception) -> bool:
        code = getattr(e, "status_code", None) or getattr(e, "code", None)
        if code is not None:
            return int(code) in (429, 500, 503)
        msg = (e.args[0] or str(e)) if e.args else str(e)
        return "429" in msg or "500" in msg or "503" in msg or "timeout" in msg.lower()

    async def _call_llm_with_fallback(
        self,
        prompt: str,
        temperature: float = 0.7,
        llm: Optional[Any] = None,
        fallback_llm: Optional[Any] = None,
    ) -> str:
        llm = llm if llm is not None else self.llm
        fallback_llm = fallback_llm if fallback_llm is not None else self._fallback_llm
        safe_fallback = "I'm having trouble generating a response right now. Could you try rephrasing or continuing?"

        async def _try_one(provider_llm: Any, validate: bool = True) -> Optional[str]:
            try:
                raw = await asyncio.wait_for(
                    provider_llm.generate_text(prompt, temperature=temperature),
                    15.0,
                )
                if not raw:
                    return None
                if validate:
                    return process_response(raw)
                return raw.strip() or None
            except asyncio.TimeoutError:
                logger.warning("LLM call timed out after 15s")
                return None
            except Exception as e:
                if self._is_retryable_error(e):
                    logger.warning("LLM retryable error: %s", e)
                else:
                    logger.error("LLM error: %s", e, exc_info=True)
                return None

        result = await _try_one(llm)
        if result:
            return result
        if fallback_llm and fallback_llm is not llm:
            logger.info("Trying fallback LLM provider")
            result = await _try_one(fallback_llm)
            if result:
                return result
        return safe_fallback

    async def _call_llm_raw_with_fallback(
        self,
        prompt: str,
        temperature: float = 0.0,
        llm: Optional[Any] = None,
        fallback_llm: Optional[Any] = None,
        empty_fallback: str = "{}",
    ) -> str:
        """Call LLM with fallback; return raw string (no response validation). For JSON etc."""
        llm = llm if llm is not None else self.llm
        fallback_llm = fallback_llm if fallback_llm is not None else self._fallback_llm

        async def _try_one(provider_llm: Any) -> Optional[str]:
            try:
                raw = await asyncio.wait_for(
                    provider_llm.generate_text(prompt, temperature=temperature),
                    15.0,
                )
                return (raw or "").strip() or None
            except asyncio.TimeoutError:
                logger.warning("LLM call timed out after 15s")
                return None
            except Exception as e:
                if self._is_retryable_error(e):
                    logger.warning("LLM retryable error: %s", e)
                else:
                    logger.error("LLM error: %s", e, exc_info=True)
                return None

        result = await _try_one(llm)
        if result:
            return result
        if fallback_llm and fallback_llm is not llm:
            result = await _try_one(fallback_llm)
            if result:
                return result
        return empty_fallback

    def _build_interviewer_prompt(
        self,
        previous_qa: List[Dict],
        interview_type: InterviewType,
        llm_context: str = "",
    ) -> str:
        last_pairs = previous_qa[-4:]
        conversation_parts = []
        for qa in last_pairs:
            q_entry = qa.get("question", {})
            q_text = _extract_question_text(q_entry)
            a_text = qa.get("response", "")
            conversation_parts.append(f"Interviewer: {q_text}\nCandidate: {a_text[:500]}")
        conversation = "\n\n".join(conversation_parts) or "Interviewer: Let's begin.\nCandidate: (no response yet)"
        interview_type_str = interview_type.value if isinstance(interview_type, InterviewType) else str(interview_type)
        context_block = llm_context.strip() or f"INTERVIEW TYPE: {interview_type_str}\nCONVERSATION SO FAR:\n{conversation}"

        return f"""SYSTEM PROMPT FOR INTERVIEWER LLM:

You are a senior software engineer conducting a real technical interview.
You are not a question dispenser. You are a person having a conversation.

Your personality:
- Curious and direct. You ask because you genuinely want to understand.
- Patient but not passive. If an answer is incomplete, you probe.
- You push harder when someone is doing well. You back off when they're lost.
- You occasionally say "hmm" or pause. You're thinking too.
- You never say "Great answer!" or "Excellent!" - it sounds fake.
  Instead: "Right.", "Okay, that makes sense.", "Interesting." or nothing.
- You reference things said earlier. You remember the whole conversation.
- When the candidate is coding, you acknowledge what you see on screen.

Your one rule:
Always react to what was JUST said before asking anything new.
Never jump to the next question without acknowledging the last answer.
Even a single word ("Right.") is enough. Never skip this.

THE CONTEXT BELOW IS YOUR REALITY. Trust it completely.
Adapt everything you say to what it tells you about this candidate right now.

{context_block}

RECENT DIALOGUE:
{conversation}

Now respond as the interviewer. One focused thing at a time."""

    async def generate_greeting(self, candidate_name: str, role: str) -> str:
        """Generates a warm, professional intro"""
        prompt = f"""You are a senior technical interviewer for a {role} position. 
The candidate's name is {candidate_name}.

Generate a short, professional 2-sentence greeting to start the interview. 
Keep it friendly and encouraging. Do NOT ask a technical question yet.

Example: "Hello {candidate_name}! Welcome to this {role} interview. I'm excited to learn more about your experience today."
"""
        return await self._call_llm_with_fallback(prompt, temperature=0.7)

    async def process_answer_and_generate_followup(
        self,
        session_id: str,
        user_answer: str,
        llm_context: str = "",
    ) -> Dict[str, Any]:
        """
        Processes user's answer, stores it, generates a follow-up question, and returns
        a structured question object suitable for UI / TTS.
        Returns a dict like:
        {
          "question": {...} or "question": "text",
          "type": "<type>",
          "timestamp": "..."
        }
        """
        try:
            prepared = await self.prepare_followup(session_id, user_answer)
            if prepared.get("done"):
                return prepared["response"]

            next_question_text = await self.generate_follow_up(
                prepared["responses"],
                prepared["interview_type"],
                llm_context=llm_context or prepared.get("llm_context", ""),
            )
            return await self.persist_followup_question(prepared, next_question_text)
        except Exception as e:
            logger.error(f"❌ Error processing answer: {e}", exc_info=True)
            return {"question": "I encountered an error. Could you please repeat your answer?", "type": "behavioral", "timestamp": datetime.now(timezone.utc).isoformat()}

    async def prepare_followup(self, session_id: str, user_answer: str) -> Dict[str, Any]:
        """Store the current answer and return context for generating the next question."""
        session_key = f"interview:{session_id}"
        session_data = await get_session(session_key)
        if not session_data:
            logger.error(f"Session {session_id} not found")
            return {
                "done": True,
                "response": {
                    "question": "I couldn't find your interview session. Let's restart.",
                    "type": "behavioral",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }

        current_q_index = int(session_data.get("current_question_index", 0))
        questions = session_data.get("questions", []) or []
        if current_q_index >= len(questions):
            logger.info(f"Max questions reached for {session_id}")
            return {
                "done": True,
                "response": {
                    "question": "Thank you for your responses! That completes our interview for today.",
                    "type": "behavioral",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }

        interview_type = _parse_interview_type(session_data.get("interview_type", "dsa"))
        normalized_current_question = _normalize_question_entry(
            questions[current_q_index],
            default_type=interview_type.value,
        )
        responses = session_data.get("responses", []) or []
        responses.append(
            {
                "question_index": current_q_index,
                "question": normalized_current_question,
                "response": user_answer,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

        max_questions = get_settings().max_questions_per_interview
        if len(responses) >= max_questions:
            session_data["responses"] = responses
            session_data["current_question_index"] = current_q_index + 1
            await update_session(session_key, session_data, expire_seconds=SESSION_TTL)
            logger.info(f"Max questions ({max_questions}) reached for {session_id}")
            return {
                "done": True,
                "response": {
                    "question": "Thank you for your responses! That completes our interview for today.",
                    "type": "behavioral",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }

        return {
            "done": False,
            "session_key": session_key,
            "session_data": session_data,
            "questions": questions,
            "responses": responses,
            "current_q_index": current_q_index,
            "interview_type": interview_type,
            "current_question": normalized_current_question,
        }

    async def persist_followup_question(self, prepared: Dict[str, Any], next_question_text: str) -> Dict[str, Any]:
        """Persist the generated follow-up question and return the wrapped object."""
        next_question_obj = {
            "question": {"question": (next_question_text or "").strip()},
            "type": prepared["interview_type"].value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        prepared["questions"].append(next_question_obj)
        prepared["session_data"]["questions"] = prepared["questions"]
        prepared["session_data"]["responses"] = prepared["responses"]
        prepared["session_data"]["current_question_index"] = prepared["current_q_index"] + 1
        await update_session(
            prepared["session_key"],
            prepared["session_data"],
            expire_seconds=SESSION_TTL,
        )
        logger.info(
            "✅ Stored response for Q%s and generated next question.",
            prepared["current_q_index"],
        )
        return next_question_obj

    async def generate_first_question(
        self,
        interview_type: InterviewType,
        difficulty: DifficultyLevel,
        resume_data: Dict = None,
        custom_role: str = None,
        years_experience: Optional[int] = None
    ) -> Dict[str, Any]:
        """Generate contextual first question"""
        context = self._build_context(interview_type, resume_data, custom_role, years_experience)

        if interview_type == InterviewType.DSA:
            q = await self._generate_dsa_question(difficulty, context)
            return {"question": q, "type": "coding", "timestamp": datetime.now(timezone.utc).isoformat()}
        elif interview_type == InterviewType.CUSTOM:
            q = await self._generate_custom_role_question(custom_role, difficulty, context)
            return {"question": q, "type": "custom_role", "timestamp": datetime.now(timezone.utc).isoformat()}
        else:
            q = await self._generate_general_question(interview_type, difficulty, context)
            return {"question": q, "type": interview_type.value, "timestamp": datetime.now(timezone.utc).isoformat()}

    def _build_context(
        self,
        interview_type: InterviewType,
        resume_data: Dict = None,
        custom_role: str = None,
        years_experience: Optional[int] = None
    ) -> str:
        """Build context from resume data. Supports legacy (list of {name}) and LLM profile (skills dict, projects list of dicts)."""
        context = ""

        if resume_data:
            raw_skills = resume_data.get("skills")
            raw_projects = resume_data.get("projects") or []

            # Skills: either list of {name: "..."} (legacy) or dict of lists (LLM profile)
            if isinstance(raw_skills, dict):
                skills = []
                for key in ("languages", "frameworks", "databases", "cloud", "tools", "ml_ai", "other"):
                    part = raw_skills.get(key) or []
                    skills.extend(s for s in part if isinstance(s, str) and s.strip())
            elif isinstance(raw_skills, list):
                skills = []
                for s in raw_skills:
                    if isinstance(s, str) and s.strip():
                        skills.append(s)
                    elif isinstance(s, dict):
                        skills.append((s.get("name") or "").strip())
                skills = [s for s in skills if s]
            else:
                skills = []

            # Projects: list of dicts with "name" or list of strings
            projects = []
            for p in raw_projects:
                if isinstance(p, dict):
                    name = (p.get("name") or "").strip()
                    if name:
                        projects.append(name)
                elif isinstance(p, str) and p.strip():
                    projects.append(p.strip())

            if skills:
                context += f"\nCandidate Skills: {', '.join(skills[:10])}"
            if projects:
                context += f"\nProjects: {', '.join(projects[:3])}"

        if custom_role:
            context += f"\nTarget Role: {custom_role}"

        if years_experience is not None:
            context += f"\nYears of Experience: {years_experience}"

        return context

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
            raw = await _lc.get_random_problem(cap_diff, exclude_topics=DSA_EXCLUDE_TOPICS)
            if raw is None:
                logger.warning("LeetCode returned only excluded (e.g. Database) problems, falling back to LLM")
                return await self._generate_dsa_question_llm(difficulty, context)
            question_data = _lc.normalize(raw, difficulty.value)
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

        response = await self.llm.generate_text(prompt, temperature=0.3)
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

        response = await self.llm.generate_text(prompt, temperature=0.7)

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

        response = await self.llm.generate_text(prompt, temperature=0.7)

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

        response = await self.llm.generate_text(prompt, temperature=0.7)

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

        analysis = await self.llm.generate_text(prompt, temperature=0.3)

        return {
            'analysis': analysis,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

    async def generate_follow_up(
        self,
        previous_qa: List[Dict],
        interview_type: InterviewType,
        llm_context: str = "",
    ) -> str:
        """Generate the interviewer's next spoken response."""
        prompt = self._build_interviewer_prompt(previous_qa, interview_type, llm_context=llm_context)
        question = await self._call_llm_with_fallback(prompt, temperature=0.8)
        return question.strip()

    async def generate_follow_up_stream(
        self,
        previous_qa: List[Dict],
        interview_type: InterviewType,
        llm_context: str = "",
    ) -> AsyncGenerator[str, None]:
        """Stream the interviewer's next spoken response token-by-token."""
        prompt = self._build_interviewer_prompt(previous_qa, interview_type, llm_context=llm_context)

        if hasattr(self.llm, "generate_text_stream"):
            async for chunk in self.llm.generate_text_stream(prompt, temperature=0.8):
                yield chunk
            return

        yield await self.generate_follow_up(previous_qa, interview_type, llm_context=llm_context)

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
        if hasattr(self.eval_llm, "json_completion"):
            try:
                raw = await asyncio.wait_for(
                    self.eval_llm.json_completion(system_prompt, user_prompt),
                    15.0,
                )
            except (asyncio.TimeoutError, Exception) as e:
                if self._is_retryable_error(e) or isinstance(e, asyncio.TimeoutError):
                    logger.warning("Eval LLM failed, trying fallback: %s", e)
                if self._fallback_llm and self._fallback_llm is not self.eval_llm:
                    raw = await self._call_llm_raw_with_fallback(
                        f"{system_prompt}\n\n{user_prompt}",
                        temperature=0.0,
                        llm=self._fallback_llm,
                        fallback_llm=None,
                        empty_fallback="{}",
                    )
        else:
            raw = await self._call_llm_raw_with_fallback(
                f"{system_prompt}\n\n{user_prompt}",
                temperature=0.0,
                llm=self.eval_llm,
                fallback_llm=self._fallback_llm,
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

    async def generate_final_feedback(
        self,
        session_data: Dict
    ) -> Dict[str, Any]:
        """Generate comprehensive final feedback"""
        qa_summary_parts = []
        for i, qa in enumerate(session_data.get('responses', [])):
            q_entry = qa.get('question', {})
            q_text = _extract_question_text(q_entry)
            a_text = qa.get('response', '')[:300]
            qa_summary_parts.append(f"Q{i+1}: {q_text}\nA{i+1}: {a_text}")
        qa_summary = "\n\n".join(qa_summary_parts)

        prompt = f"""Provide interview feedback:

Type: {session_data.get('interview_type')}
Duration: {session_data.get('duration', 0)} minutes
Questions Answered: {len(session_data.get('responses', []))}

Conversation:
{qa_summary}

Provide structured feedback:

OVERALL PERFORMANCE:
[2-3 sentence summary]

TECHNICAL SKILLS: X/10
[Brief assessment]

COMMUNICATION: X/10
[Brief assessment]

KEY STRENGTHS:
- [strength 1]
- [strength 2]
- [strength 3]

AREAS FOR IMPROVEMENT:
- [area 1 with specific action]
- [area 2 with specific action]
- [area 3 with specific action]

RECOMMENDATION: [Hire / Strong Maybe / Needs Improvement]
[One sentence rationale]"""

        feedback = await self._call_llm_with_fallback(prompt, temperature=0.3)

        return {
            'feedback': feedback,
            'generated_at': datetime.now(timezone.utc).isoformat()
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

