"""Parse numeric scores from interview feedback text."""
import re
from typing import Dict, Optional


def parse_scores_from_feedback(feedback_text: Optional[str]) -> Dict[str, float]:

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
