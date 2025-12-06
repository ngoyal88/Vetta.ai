# services/interview_service.py
import json
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timezone
from services.gemini_service import GeminiService
from models.interview import InterviewType, DifficultyLevel
from utils.logger import get_logger
from utils.redis_client import get_session, update_session

logger = get_logger("InterviewService")


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
        self.gemini = GeminiService()

    async def generate_greeting(self, candidate_name: str, role: str) -> str:
        """Generates a warm, professional intro"""
        prompt = f"""You are a senior technical interviewer for a {role} position. 
The candidate's name is {candidate_name}.

Generate a short, professional 2-sentence greeting to start the interview. 
Keep it friendly and encouraging. Do NOT ask a technical question yet.

Example: "Hello {candidate_name}! Welcome to this {role} interview. I'm excited to learn more about your experience today."
"""
        return await self.gemini.generate_text(prompt, temperature=0.7)

    async def process_answer_and_generate_followup(
        self,
        session_id: str,
        user_answer: str
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
            # 1. Retrieve session
            session_key = f"interview:{session_id}"
            session_data = await get_session(session_key)
            if not session_data:
                logger.error(f"Session {session_id} not found")
                return {"question": "I couldn't find your interview session. Let's restart.", "type": "behavioral", "timestamp": datetime.now(timezone.utc).isoformat()}

            # 2. Get current question index & list (ensure questions is list)
            current_q_index = int(session_data.get('current_question_index', 0))
            questions = session_data.get('questions', []) or []

            if current_q_index >= len(questions):
                logger.info(f"Max questions reached for {session_id}")
                return {"question": "Thank you for your responses! That completes our interview for today.", "type": "behavioral", "timestamp": datetime.now(timezone.utc).isoformat()}

            current_question_raw = questions[current_q_index]
            # Normalize the stored current question for consistent downstream handling
            interview_type_str = session_data.get('interview_type', 'dsa')
            # robust parse
            interview_type = _parse_interview_type(interview_type_str)
            normalized_current_question = _normalize_question_entry(current_question_raw, default_type=interview_type.value)

            # 3. Store user's response
            responses = session_data.get('responses', []) or []
            responses.append({
                'question_index': current_q_index,
                'question': normalized_current_question,
                'response': user_answer,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })

            # 4. Generate follow-up question text (string)
            next_question_text = await self.generate_follow_up(responses, interview_type)

            # 5. Wrap next question into consistent object
            next_question_obj = {
                "question": {"question": next_question_text},
                "type": interview_type.value,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            # 6. Append new question AND then increment current_question_index
            questions.append(next_question_obj)
            session_data['questions'] = questions
            session_data['responses'] = responses
            # increment index so next time frontend will read the just-appended question
            session_data['current_question_index'] = current_q_index + 1
            await update_session(session_key, session_data)

            logger.info(f"✅ Stored response for Q{current_q_index} and generated next question.")
            return next_question_obj

        except Exception as e:
            logger.error(f"❌ Error processing answer: {e}", exc_info=True)
            return {"question": "I encountered an error. Could you please repeat your answer?", "type": "behavioral", "timestamp": datetime.now(timezone.utc).isoformat()}

    async def generate_first_question(
        self,
        interview_type: InterviewType,
        difficulty: DifficultyLevel,
        resume_data: Dict = None,
        custom_role: str = None
    ) -> Dict[str, Any]:
        """Generate contextual first question"""
        context = self._build_context(interview_type, resume_data, custom_role)

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
        custom_role: str = None
    ) -> str:
        """Build context from resume data"""
        context = ""

        if resume_data:
            skills = [s.get('name', '') for s in resume_data.get('skills', [])]
            projects = [p.get('name', '') for p in resume_data.get('projects', [])]

            if skills:
                context += f"\nCandidate Skills: {', '.join(skills[:10])}"
            if projects:
                context += f"\nProjects: {', '.join(projects[:3])}"

        if custom_role:
            context += f"\nTarget Role: {custom_role}"

        return context

    async def _generate_dsa_question(
        self,
        difficulty: DifficultyLevel,
        context: str
    ) -> Dict[str, Any]:
        """Generate DSA coding question with test cases"""
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
        {{"input": "test1_input", "output": "test1_output"}},
        {{"input": "test2_input", "output": "test2_output"}},
        {{"input": "test3_input", "output": "test3_output"}}
    ],
    "hints": ["hint1", "hint2"],
    "time_complexity_expected": "O(n)",
    "space_complexity_expected": "O(1)"
}}"""

        response = await self.gemini.generate_text(prompt, temperature=0.7)

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

            logger.info(f"✅ Generated DSA question: {question_data.get('title')}")
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

        response = await self.gemini.generate_text(prompt, temperature=0.7)

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

        response = await self.gemini.generate_text(prompt, temperature=0.7)

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

        analysis = await self.gemini.generate_text(prompt, temperature=0.3)

        return {
            'analysis': analysis,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

    async def generate_follow_up(
        self,
        previous_qa: List[Dict],
        interview_type: InterviewType
    ) -> str:
        """Generate follow-up question based on conversation (returns plain question text)."""
        # Get last 2 Q&A pairs for context
        last_pairs = previous_qa[-2:]
        conversation_parts = []
        for qa in last_pairs:
            q_entry = qa.get('question', {})
            q_text = _extract_question_text(q_entry)
            a_text = qa.get('response', '')
            conversation_parts.append(f"Q: {q_text}\nA: {a_text[:200]}")
        conversation = "\n\n".join(conversation_parts)

        interview_type_str = interview_type.value if isinstance(interview_type, InterviewType) else str(interview_type)

        prompt = f"""Based on this {interview_type_str} interview conversation:

{conversation}

Generate ONE specific follow-up question that:
1. Probes deeper into their answer
2. Tests understanding or problem-solving
3. Is conversational and natural

Just the question, no preamble."""

        question = await self.gemini.generate_text(prompt, temperature=0.8)
        return question.strip()

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

        feedback = await self.gemini.generate_text(prompt, temperature=0.3)

        return {
            'feedback': feedback,
            'generated_at': datetime.now(timezone.utc).isoformat()
        }

    def _get_fallback_dsa_question(self, difficulty: DifficultyLevel) -> Dict[str, Any]:
        """Fallback DSA question if generation fails"""
        import uuid

        return {
            "question_id": str(uuid.uuid4()),
            "title": "Two Sum",
            "description": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.\n\nYou may assume each input has exactly one solution, and you may not use the same element twice.",
            "input_format": "nums = [2,7,11,15], target = 9",
            "output_format": "[0,1]",
            "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
            "example": {
                "input": "nums = [2,7,11,15], target = 9",
                "output": "[0,1]",
                "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."
            },
            "test_cases": [
                {"input": "[2,7,11,15]\n9", "output": "[0,1]"},
                {"input": "[3,2,4]\n6", "output": "[1,2]"},
                {"input": "[3,3]\n6", "output": "[0,1]"}
            ],
            "hints": [
                "Use a hash map to store values you've seen",
                "For each number, check if target - number exists in the map"
            ],
            "type": "coding",
            "difficulty": difficulty.value
        }
