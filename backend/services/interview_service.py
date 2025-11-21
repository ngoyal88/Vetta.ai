# ========================================
# 4. services/interview_service.py - Core interview logic
# ========================================

import json
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from services.gemini_service import GeminiService
from models.interview import InterviewType, DifficultyLevel, CodingQuestion, TestCase
from utils.logger import get_logger

logger = get_logger("InterviewService")


class InterviewService:
    def __init__(self):
        self.gemini = GeminiService()
    
    async def generate_first_question(
        self, 
        interview_type: InterviewType,
        difficulty: DifficultyLevel,
        resume_data: Dict = None,
        custom_role: str = None
    ) -> Dict[str, Any]:
        """Generate contextual first question"""
        
        # Build context
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
        
        prompt = f"""Generate a {difficulty.value} difficulty Data Structures & Algorithms coding problem.

Context: {context}

Return a JSON object with this structure:
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
}}

Focus on common interview topics like arrays, strings, trees, graphs, dynamic programming.
Make it realistic and solvable in 30-45 minutes."""

        response = await self.gemini.generate_text(prompt)
        
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            json_str = response[json_start:json_end]
            question_data = json.loads(json_str)
            
            question_data['type'] = 'coding'
            question_data['difficulty'] = difficulty.value
            return question_data
            
        except json.JSONDecodeError:
            logger.error("Failed to parse DSA question JSON")
            # Return fallback question
            return self._get_fallback_dsa_question(difficulty)
    
    async def _generate_custom_role_question(
        self,
        role: str,
        difficulty: DifficultyLevel,
        context: str
    ) -> Dict[str, Any]:
        """Generate question for custom role"""
        
        prompt = f"""You are interviewing a candidate for the role: {role}

Difficulty: {difficulty.value}
{context}

Generate ONE highly relevant technical question for this role.
Focus on:
- Role-specific technologies and frameworks
- Real-world scenarios they'll face
- Technical depth appropriate for the role

Format your response as:
Question: [Your question here]
Expected Topics: [Key topics they should cover]
Follow-up Ideas: [2-3 potential follow-up questions]"""

        response = await self.gemini.generate_text(prompt)
        
        return {
            'type': 'custom_role',
            'role': role,
            'question': response,
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
            InterviewType.FRONTEND: "frontend development (React, JavaScript, CSS, performance, accessibility)",
            InterviewType.BACKEND: "backend development (APIs, databases, scalability, security)",
            InterviewType.CORE_CS: "computer science fundamentals (OS, Networks, DBMS, OOP)",
            InterviewType.BEHAVIORAL: "behavioral and situational scenarios (teamwork, problem-solving, leadership)",
            InterviewType.RESUME_BASED: f"their resume and experience{context}"
        }
        
        topic = type_prompts.get(interview_type, "software engineering")
        
        prompt = f"""Generate ONE {difficulty.value} difficulty interview question about {topic}.

{context}

The question should:
- Be clear and specific
- Test practical knowledge
- Be answerable in 3-5 minutes
- Have clear evaluation criteria

Format:
Question: [Your question]
Key Points to Cover: [What a good answer should include]
Red Flags: [What indicates gaps in knowledge]"""

        response = await self.gemini.generate_text(prompt)
        
        return {
            'type': interview_type.value,
            'question': response,
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

Interview Type: {interview_type.value}
Question: {question}
Candidate's Response: {candidate_response}

Provide analysis in this format:

STRENGTHS:
- [Positive aspect 1]
- [Positive aspect 2]

WEAKNESSES:
- [Gap or issue 1]
- [Gap or issue 2]

SUGGESTIONS:
- [Specific improvement advice 1]
- [Specific improvement advice 2]

SCORE: [0-10]/10

FOLLOW-UP AREAS:
- [Topic to probe deeper]
- [Concept to clarify]

Keep it concise and actionable."""

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
        """Generate follow-up question based on conversation"""
        
        conversation = "\n\n".join([
            f"Q: {qa.get('question', '')}\nA: {qa.get('response', '')}"
            for qa in previous_qa[-3:]  # Last 3 Q&As
        ])
        
        prompt = f"""Based on this interview conversation for {interview_type.value}:

{conversation}

Generate ONE specific follow-up question that:
- Builds on their previous answer
- Explores depth of understanding
- Tests practical application
- Is clear and focused

Just provide the question, no explanation."""

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
        
        prompt = f"""Provide comprehensive interview feedback:

Interview Type: {session_data.get('interview_type', '')}
Duration: {session_data.get('duration', 0)} minutes
Questions: {len(session_data.get('responses', []))}

Q&A Summary:
{qa_summary}

Provide structured feedback:

OVERALL PERFORMANCE:
[2-3 sentence summary]

TECHNICAL SKILLS (Score: X/10):
[Assessment]

COMMUNICATION (Score: X/10):
[Assessment]

PROBLEM-SOLVING (Score: X/10):
[Assessment]

KEY STRENGTHS:
1. [Strength with example]
2. [Strength with example]
3. [Strength with example]

IMPROVEMENT AREAS:
1. [Area] - Priority: High/Medium/Low
   Action: [Specific steps]
   Resources: [What to study]

2. [Area] - Priority: High/Medium/Low
   Action: [Specific steps]
   Resources: [What to study]

READINESS LEVEL:
[Entry/Mid/Senior Level assessment]

RECOMMENDATION:
[Hire/Strong Maybe/Not Yet - with reasoning]

NEXT STEPS:
1. [Action item]
2. [Action item]
3. [Action item]"""

        feedback = await self.gemini.generate_text(prompt, temperature=0.3)
        
        return {
            'feedback': feedback,
            'generated_at': datetime.now(timezone.utc).isoformat()
        }
    
    def _get_fallback_dsa_question(self, difficulty: DifficultyLevel) -> Dict[str, Any]:
        """Fallback DSA question if generation fails"""
        fallback_questions = {
            DifficultyLevel.EASY: {
                "title": "Two Sum",
                "description": "Given an array of integers nums and an integer target, return indices of two numbers that add up to target.",
                "input_format": "Array of integers and target integer",
                "output_format": "Array of two indices",
                "example": {
                    "input": "[2,7,11,15], target=9",
                    "output": "[0,1]",
                    "explanation": "nums[0] + nums[1] = 2 + 7 = 9"
                },
                "test_cases": [
                    {"input": "[2,7,11,15]\n9", "output": "[0,1]"},
                    {"input": "[3,2,4]\n6", "output": "[1,2]"},
                    {"input": "[3,3]\n6", "output": "[0,1]"}
                ],
                "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
                "hints": ["Use a hash map to store seen numbers"],
                "type": "coding",
                "difficulty": "easy"
            }
        }
        
        return fallback_questions.get(difficulty, fallback_questions[DifficultyLevel.EASY])

# Expose a reusable service instance for modules that import `interview_service`
# This enables `from services.interview_service import interview_service`
interview_service = InterviewService()
