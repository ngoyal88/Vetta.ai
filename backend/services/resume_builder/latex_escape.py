"""LaTeX escaping for user-provided text."""

from __future__ import annotations

from typing import Any


_LATEX_ESCAPES = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def latex_escape(value: Any) -> str:
    text = "" if value is None else str(value)
    return "".join(_LATEX_ESCAPES.get(ch, ch) for ch in text)

