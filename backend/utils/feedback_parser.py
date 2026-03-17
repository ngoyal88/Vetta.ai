"""Parse numeric scores from interview feedback text."""
import re
from typing import Dict, Optional


def parse_scores_from_feedback(feedback_text: Optional[str]) -> Dict[str, float]:
    """Extract numeric scores from final feedback text (best effort).

    Looks for TECHNICAL SKILLS: X/10, COMMUNICATION: X/10, SCORE: X/10.
    Returns a dict with keys 'technical', 'communication', 'overall'.
    """
    if not feedback_text:
        return {}

    scores: Dict[str, float] = {}
    patterns = {
        "technical": re.compile(r"TECHNICAL SKILLS:\s*(\d+(?:\.\d+)?)/10", re.IGNORECASE),
        "communication": re.compile(r"COMMUNICATION:\s*(\d+(?:\.\d+)?)/10", re.IGNORECASE),
        "overall": re.compile(r"SCORE:\s*(\d+(?:\.\d+)?)/10", re.IGNORECASE),
    }

    for key, pattern in patterns.items():
        match = pattern.search(feedback_text)
        if match:
            scores[key] = float(match.group(1))

    if "overall" not in scores and scores:
        scores["overall"] = sum(scores.values()) / len(scores)

    return scores
