import re
from typing import Any, AsyncGenerator, Optional, List, Dict

from utils.logger import get_logger
from models.interview import InterviewType
from services.interview.llm_engine import LLMEngine
from services.interview.prompt_contracts import build_follow_up_prompt

logger = get_logger("PromptEngine")

class PromptEngine:
    def __init__(self, engine:LLMEngine):
        self._engine = engine

    def _build_interviewer_prompt(self, previous_qa: List[Dict], interview_type: InterviewType, llm_context: str = "",) -> str:
        return build_follow_up_prompt(previous_qa, interview_type, llm_context)

    def _clamp_greeting_text(self, raw: str, max_chars: int = 420) -> str:
        """Keep TTS short: first 1–2 sentences, bounded length (avoids huge MP3 / slow playback)."""
        text = (raw or "").strip()
        if not text:
            return ""
        sentences = re.split(r"(?<=[.!?])\s+", text)
        out = " ".join(sentences[:2]).strip()
        if not out:
            out = text
        if len(out) > max_chars:
            out = text[:max_chars].rsplit(" ", 1)[0].strip() + "."
        return out

    async def generate_greeting(self, candidate_name: str, role: str) -> str:
        """Generates a warm, professional intro"""
        prompt = f"""You are a senior technical interviewer for a {role} position. 
The candidate's name is {candidate_name}.

Generate a short, professional 2-sentence greeting to start the interview. 
Keep it friendly and encouraging. Do NOT ask a technical question yet.

Example: "Hello {candidate_name}! Welcome to this {role} interview. I'm excited to learn more about your experience today."
"""
        raw = await self._engine.generate(prompt, 0.55)
        clamped = self._clamp_greeting_text(raw)
        return clamped if clamped else self._clamp_greeting_text(
            f"Hello {candidate_name}. Welcome to this {role} interview. Let's begin."
        )


    def _build_context(
        self,
        interview_type: InterviewType,
        resume_data: Dict = None,
        custom_role: str = None,
        years_experience: Optional[int] = None,
        target_context: Optional[Dict[str, Any]] = None,
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

        if target_context:
            target_company = target_context.get("target_company")
            target_role = target_context.get("target_role")
            interview_focus = target_context.get("interview_focus")
            jd_fit = target_context.get("jd_fit_context") or {}
            resume_probe = target_context.get("resume_probe_context") or {}
            job_description = (target_context.get("job_description") or "")[:1800]
            if target_company or target_role or interview_focus or job_description or jd_fit:
                context += "\n\nROLE-TARGETED CONTEXT:"
                if target_company:
                    context += f"\nTarget Company: {target_company}"
                if target_role:
                    context += f"\nTarget Role: {target_role}"
                if interview_focus:
                    context += f"\nInterview Focus: {str(interview_focus).replace('_', ' ')}"
                if job_description:
                    context += f"\nJob Description Excerpt: {job_description}"
                if isinstance(jd_fit, dict):
                    summary = jd_fit.get("summary")
                    if summary:
                        context += f"\nJD Fit Summary: {summary}"
                    for label, key in (
                        ("Required Skills", "required_skills"),
                        ("Candidate Strengths", "candidate_strengths"),
                        ("Candidate Gaps", "candidate_gaps"),
                        ("Probing Areas", "probing_areas"),
                        ("Interview Plan", "interview_plan"),
                    ):
                        values = jd_fit.get(key)
                        if isinstance(values, list) and values:
                            context += f"\n{label}: {', '.join([str(v) for v in values[:6]])}"
            if isinstance(resume_probe, dict) and resume_probe:
                context += "\n\nRESUME DEEP DIVE CONTEXT:"
                summary = resume_probe.get("summary")
                if summary:
                    context += f"\nSummary: {str(summary)[:600]}"
                for label, key in (
                    ("Probing Areas", "probing_areas"),
                    ("Interview Plan", "interview_plan"),
                    ("Candidate Strengths", "candidate_strengths"),
                    ("Candidate Gaps", "candidate_gaps"),
                ):
                    values = resume_probe.get(key)
                    if isinstance(values, list) and values:
                        context += f"\n{label}: {', '.join([str(v) for v in values[:6]])}"
                targets = resume_probe.get("probe_targets")
                if isinstance(targets, list) and targets:
                    context += "\nProbe Targets:"
                    for idx, target in enumerate(targets[:5]):
                        if not isinstance(target, dict):
                            continue
                        label = str(target.get("label") or target.get("kind") or f"target_{idx + 1}")
                        detail = str(target.get("detail") or target.get("resume_ref") or "")[:180]
                        context += f"\n{idx + 1}. {label} — {detail}"

            profile_memory = target_context.get("profile_memory_summary") or {}
            if isinstance(profile_memory, dict):
                lines: list[str] = []
                for bucket in ("technical", "experience", "behavioral"):
                    entries = profile_memory.get(bucket) or []
                    if not isinstance(entries, list):
                        continue
                    for entry in entries[:4]:
                        if not isinstance(entry, dict):
                            continue
                        text = str(entry.get("claim_text") or "").strip()
                        if text:
                            lines.append(f"[{bucket}] {text}")
                gaps = profile_memory.get("gaps") or []
                gap_lines: list[str] = []
                if isinstance(gaps, list):
                    for entry in gaps[:5]:
                        if not isinstance(entry, dict):
                            continue
                        text = str(entry.get("claim_text") or "").strip()
                        if text:
                            gap_lines.append(text)
                if lines or gap_lines:
                    context += "\n\nVERIFIED_PROFILE_CLAIMS (accepted only):"
                    for line in lines[:12]:
                        context += f"\n- {line}"
                    if gap_lines:
                        context += "\nOpen practice gaps:"
                        for gap in gap_lines[:5]:
                            context += f"\n- {gap}"

        return context


    async def generate_follow_up(self, previous_qa: List[Dict], interview_type: InterviewType, llm_context: str = "",) -> str:
        """Generate the interviewer's next spoken response."""
        prompt = self._build_interviewer_prompt(previous_qa, interview_type, llm_context=llm_context)
        question = await self._engine.generate(prompt, 0.8)
        return question.strip()

    async def generate_follow_up_stream(self, previous_qa: List[Dict], interview_type: InterviewType, llm_context: str = "",) -> AsyncGenerator[str, None]:
        """Stream the interviewer's next spoken response token-by-token."""
        prompt = self._build_interviewer_prompt(previous_qa, interview_type, llm_context=llm_context)

        async for chunk in self._engine.generate_stream(prompt, 0.8):
            yield chunk



