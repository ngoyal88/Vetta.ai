"""
Centralized parsing of numeric scores from interview feedback text.
Used by interview REST routes and interview_websocket handler.
"""
import re
from typing import Dict, Any, Optional


def parse_scores_from_feedback(feedback_text: Optional[str]) -> Dict[str, float]:
    """
    Extract simple numeric scores from the final feedback text (best effort).
    Looks for TECHNICAL SKILLS: X/10, COMMUNICATION: X/10, SCORE: X/10.
    Returns dict with keys 'technical', 'communication', 'overall' (floats).
    """
    if not feedback_text:
        return {}

    scores: Dict[str, float] = {}
    tech_match = re.search(
        r"TECHNICAL SKILLS:\s*(\d+(?:\.\d+)?)/10", feedback_text, re.IGNORECASE
    )
    comm_match = re.search(
        r"COMMUNICATION:\s*(\d+(?:\.\d+)?)/10", feedback_text, re.IGNORECASE
    )
    overall_match = re.search(
        r"SCORE:\s*(\d+(?:\.\d+)?)/10", feedback_text, re.IGNORECASE
    )

    if tech_match:
        scores["technical"] = float(tech_match.group(1))
    if comm_match:
        scores["communication"] = float(comm_match.group(1))
    if overall_match:
        scores["overall"] = float(overall_match.group(1))
    elif scores:
        scores["overall"] = sum(scores.values()) / len(scores)

    return scores
