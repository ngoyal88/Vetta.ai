# ========================================
# services/interview_service.py - COMPLETE Implementation
# ========================================

import json
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from services.gemini_service import GeminiService
from models.interview import InterviewType, DifficultyLevel
from utils.logger import get_logger
from utils.redis_client import get_session, update_session

logger = get_logger("InterviewService")


class InterviewService:
    def __init__(self):
        self.gemini = GeminiService()
    
    async def generate_greeting(self, candidate_name: str, role: str) -> str:
        """Generates a warm, professional intro."""
        prompt = f"""
        You are a senior technical interviewer for a {role} position. 
        The candidate's name is {candidate_name}.
        
        Generate a short, professional 2-sentence greeting to start the interview. 
        Do NOT ask a technical question yet. Just welcome them warmly.
        """
        return await self.gemini.generate_text(prompt)
    
    async def process_answer_and_generate_followup(
        self, 
        session_id: str, 
        user_answer: str
    ) -> str:
        """
        ⚠️ MISSING METHOD - This is what websocket_interview.py calls!
        Processes user's answer and generates the next question.
        """
        try:
            # 1. Retrieve session
            session_data = await get_session(f"interview:{session_id}")
            if not session_data:
                return "I couldn't find your session. Let's restart."
            
            # 2. Get current question
            current_q_index = session_data.get('current_question_index', 0)
            questions = session_data.get('questions', [])
            
            if current_q_index >= len(questions):
                return "That's all for today. Thank you!"
            
            current_question = questions[current_q_index]
            
            # 3. Store user's response
            responses = session_data.get('responses', [])
            responses.append({
                'question_index': current_q_index,
                'question': current_question,
                'response': user_answer,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            
            # 4. Update session
            session_data['responses'] = responses
            session_data['current_question_index'] = current_q_index + 1
            await update_session(f"interview:{session_id}", session_data)
            
            # 5. Generate follow-up question
            next_question = await self.generate_follow_up(
                responses, 
                InterviewType(session_data.get('interview_type', 'dsa'))
            )
            
            # 6. Add to session
            questions.append({
                'question': next_question,
                'type': session_data.get('interview_type'),
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            session_data['questions'] = questions
            await update_session(f"interview:{session_id}", session_data)
            
            return next_question
            
        except Exception as e:
            logger.error(f"Error processing answer: {e}", exc_info=True)
            return "I encountered an error. Could you repeat your answer?"
    
    # ... rest of your existing methods ...
    
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
            return await self._generate_dsa_question(difficulty, context)
        elif interview_type == InterviewType.CUSTOM:
            return await self._generate_custom_role_question(custom_role, difficulty, context)
        else:
            return await self._generate_general_question(interview_type, difficulty, context)
    
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

        prompt = f"""Generate a {difficulty.value} difficulty DSA problem.

Context: {context}

Return ONLY valid JSON (no markdown, no backticks):
{{
    "title": "Problem title",
    "description": "Detailed problem description",
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

        response = await self.gemini.generate_text(prompt)
        
        try:
            resp = response.strip().strip('`').strip()
            if resp.startswith('json'):
                resp = resp[4:]
            json_start = resp.find('{')
            json_end = resp.rfind('}') + 1
            json_str = resp[json_start:json_end]
            question_data = json.loads(json_str)
            
            question_data['question_id'] = str(uuid.uuid4())
            question_data['type'] = 'coding'
            question_data['difficulty'] = difficulty.value
            return question_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse DSA question JSON: {e}")
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

Generate ONE technical question for this role.

Return ONLY valid JSON (no markdown):
{{
    "question": "Your question here",
    "evaluation_criteria": "Key points to look for"
}}"""

        response = await self.gemini.generate_text(prompt)
        
        try:
            resp = response.strip().strip('`').strip()
            if resp.startswith('json'):
                resp = resp[4:]
            start = resp.find('{')
            end = resp.rfind('}') + 1
            obj = json.loads(resp[start:end])
            question_text = obj.get('question', response)
            criteria = obj.get('evaluation_criteria', '')
        except Exception:
            question_text = response
            criteria = ''

        return {
            'type': 'custom_role',
            'role': role,
            'question': question_text,
            'evaluation_criteria': criteria,
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
            InterviewType.FRONTEND: "frontend development (React, JavaScript, CSS)",
            InterviewType.BACKEND: "backend development (APIs, databases, scalability)",
            InterviewType.CORE_CS: "computer science fundamentals (OS, Networks, DBMS)",
            InterviewType.BEHAVIORAL: "behavioral scenarios (teamwork, problem-solving)",
            InterviewType.RESUME_BASED: f"their resume{context}"
        }
        
        topic = type_prompts.get(interview_type, "software engineering")

        prompt = f"""Generate a {difficulty.value} question about {topic}.
{context}

Return ONLY valid JSON:
{{
    "question": "The question text",
    "evaluation_criteria": "What to look for"
}}"""

        response = await self.gemini.generate_text(prompt)

        try:
            resp = response.strip().strip('`').strip()
            if resp.startswith('json'):
                resp = resp[4:]
            start = resp.find('{')
            end = resp.rfind('}') + 1
            obj = json.loads(resp[start:end])
            question_text = obj.get('question', response)
            criteria = obj.get('evaluation_criteria', '')
        except Exception:
            question_text = response
            criteria = ''

        return {
            'type': interview_type.value,
            'question': question_text,
            'evaluation_criteria': criteria,
            'difficulty': difficulty.value
        }
    
    async def analyze_response(
        self,
        question: str,
        candidate_response: str,
        interview_type: InterviewType
    ) -> Dict[str, Any]:
        """Analyze candidate's response"""
        
        prompt = f"""Analyze this interview response:

Type: {interview_type.value}
Question: {question}
Response: {candidate_response}

Format:
STRENGTHS:
- [point 1]
- [point 2]

WEAKNESSES:
- [gap 1]
- [gap 2]

SCORE: X/10"""

        analysis = await self.gemini.generate_text(prompt)
        
        return {
            'analysis': analysis,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    async def generate_follow_up(
        self,
        previous_qa: List[Dict],
        interview_type: InterviewType
    ) -> str:
        """Generate follow-up question"""
        
        conversation = "\n\n".join([
            f"Q: {qa.get('question', '')}\nA: {qa.get('response', '')}"
            for qa in previous_qa[-3:]
        ])
        
        prompt = f"""Based on this {interview_type.value} interview:

{conversation}

Generate ONE specific follow-up question that probes deeper.
Just the question, no explanation."""

        return await self.gemini.generate_text(prompt)
    
    async def generate_final_feedback(
        self,
        session_data: Dict
    ) -> Dict[str, Any]:
        """Generate comprehensive final feedback"""
        
        qa_summary = "\n\n".join([
            f"Q{i+1}: {qa.get('question', '')}\nA{i+1}: {qa.get('response', '')[:200]}..."
            for i, qa in enumerate(session_data.get('responses', []))
        ])
        
        prompt = f"""Interview Feedback:

Type: {session_data.get('interview_type')}
Duration: {session_data.get('duration', 0)} min
Questions: {len(session_data.get('responses', []))}

{qa_summary}

Provide:
OVERALL PERFORMANCE: [summary]
TECHNICAL SKILLS (X/10): [assessment]
COMMUNICATION (X/10): [assessment]
KEY STRENGTHS: [3 points]
IMPROVEMENT AREAS: [3 points with actions]
RECOMMENDATION: [Hire/Maybe/Not Yet]"""

        feedback = await self.gemini.generate_text(prompt, temperature=0.3)
        
        return {
            'feedback': feedback,
            'generated_at': datetime.now(timezone.utc).isoformat()
        }
    
    def _get_fallback_dsa_question(self, difficulty: DifficultyLevel) -> Dict[str, Any]:
        """Fallback DSA question"""
        import uuid
        
        return {
            "question_id": str(uuid.uuid4()),
            "title": "Two Sum",
            "description": "Given an array of integers and a target, return indices of two numbers that sum to target.",
            "test_cases": [
                {"input": "[2,7,11,15]\n9", "output": "[0,1]"},
                {"input": "[3,2,4]\n6", "output": "[1,2]"}
            ],
            "type": "coding",
            "difficulty": "easy"
        }

# Global instance
interview_service = InterviewService()