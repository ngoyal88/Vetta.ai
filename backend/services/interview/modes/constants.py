"""Shared interview mode constants (SSOT for cross-module imports)."""
from __future__ import annotations

INTERVIEW_FOCUS_VALUES = frozenset(
    {"mixed", "technical", "behavioral", "system_design", "dsa"}
)

PAIR_PROGRAMMING_TRACKS = frozenset({"dsa"})
