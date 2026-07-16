"""Typed JD requirement alignment and scoring for JD Fit V2."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence

from services.jd_fit.jd_fit_models import (
    RequirementAlignmentV2,
    RequirementCategoryGroup,
    TypedRequirement,
)
from services.profile_memory.umbrella_terms import normalize_text

VALID_CATEGORIES = {
    "technical_skill",
    "experience",
    "education",
    "certification",
    "domain",
    "seniority",
    "location",
    "work_authorization",
    "language",
    "management",
    "travel",
    "employment_type",
    "soft_skill",
}
VALID_IMPORTANCE = {"required", "preferred", "bonus"}
VALID_STRICTNESS = {"hard", "flexible"}
VALID_STAGES = {"ats_filter", "recruiter_screen", "hm_review"}
VALID_SATISFY_MODES = {"all", "any"}

# Soft cap — required rows are never dropped; only preferred/bonus trimmed.
REQUIREMENT_SOFT_CAP = 30

CATEGORY_GROUPS: Dict[str, RequirementCategoryGroup] = {
    "technical_skill": "technical",
    "experience": "experience",
    "education": "education",
    "certification": "certifications",
    "domain": "domain",
    "seniority": "experience",
    "location": "logistics",
    "work_authorization": "logistics",
    "language": "logistics",
    "travel": "logistics",
    "employment_type": "logistics",
    "management": "leadership",
    "soft_skill": "resume_signal",
}

IMPORTANCE_WEIGHT = {
    "required": 1.25,
    "preferred": 0.8,
    "bonus": 0.35,
}

HARD_GATE_CATEGORIES = {
    "work_authorization",
    "location",
    "certification",
    "language",
    "travel",
    "employment_type",
}


def format_requirement_label(text: str, alternatives: Sequence[str], satisfy_mode: str) -> str:
    cleaned_alts = [alt.strip() for alt in alternatives if isinstance(alt, str) and alt.strip()]
    if satisfy_mode == "any" and cleaned_alts:
        return f"{text.strip()} (or {', '.join(cleaned_alts)})"
    return text.strip()


def _normalize_alternatives(raw: Any) -> List[str]:
    if not isinstance(raw, list):
        return []
    out: List[str] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, str):
            continue
        cleaned = item.strip()[:120]
        if not cleaned:
            continue
        key = normalize_text(cleaned)
        if not key or key in {"similar", "etc", "and", "or"}:
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(cleaned)
    return out[:8]


def _dedupe_key(category: str, text: str, alternatives: Sequence[str], satisfy_mode: str) -> str:
    alt_key = "|".join(sorted(normalize_text(alt) for alt in alternatives))
    return f"{category}:{normalize_text(text)}:{alt_key}:{satisfy_mode}"


def apply_requirement_soft_cap(requirements: Sequence[TypedRequirement], cap: int = REQUIREMENT_SOFT_CAP) -> tuple[List[TypedRequirement], bool]:
    rows = list(requirements)
    if len(rows) <= cap:
        return rows, False
    required = [row for row in rows if row.importance == "required"]
    optional = sorted(
        [row for row in rows if row.importance in {"preferred", "bonus"}],
        key=lambda row: row.weight,
        reverse=True,
    )
    kept = required + optional[: max(0, cap - len(required))]
    return kept, True


def collapse_or_group_duplicates(requirements: Sequence[TypedRequirement]) -> List[TypedRequirement]:
    """Drop standalone rows whose text is already covered by a satisfy_mode=any group."""
    rows = list(requirements)
    covered: set[str] = set()
    for row in rows:
        if row.satisfy_mode != "any":
            continue
        for label in [row.text, *row.alternatives]:
            key = normalize_text(label)
            if key:
                covered.add(key)

    if not covered:
        return rows

    out: List[TypedRequirement] = []
    for row in rows:
        if row.satisfy_mode == "any":
            out.append(row)
            continue
        key = normalize_text(row.text)
        # Drop duplicate skills that are already alternatives in an OR group.
        if row.category == "technical_skill" and key in covered:
            continue
        out.append(row)
    return out


_SKILL_TOKEN_RE = re.compile(r"[A-Za-z][\w.+#]*(?:\.js)?|C\+\+|C#", re.I)
# "Node.js, Python, Java, or similar" / "one of C++, Python, or Java"
_OR_LIST_RE = re.compile(
    r"(?:"
    r"(?:one|any)\s+of\s+"
    r"|"
    r"(?:proficien(?:cy|t)|experience|familiar(?:ity)?|skills?)\s+(?:in|with|using)?\s*"
    r")?"
    r"(?P<body>"
    r"(?:[A-Za-z][\w.+#]*(?:\.js)?|C\+\+|C#)"
    r"(?:\s*[,/]\s*(?:[A-Za-z][\w.+#]*(?:\.js)?|C\+\+|C#)){1,8}"
    r"\s*,?\s*(?:or|/)\s+"
    r"(?:[A-Za-z][\w.+#]*(?:\.js)?|C\+\+|C#)"
    r"(?:\s+or\s+similar)?"
    r")",
    re.I,
)
_PAREN_OR_RE = re.compile(r"\(([^)]{6,140}?\bor\b[^)]{0,100})\)", re.I)
_PREFERRED_SECTION_RE = re.compile(
    r"(?is)(?:preferred\s+qualifications?|nice\s+to\s+have|bonus(?:\s+points?)?|pluses)\s*:?\s*(.*)$"
)
_STOP_SKILL_WORDS = {
    "and", "or", "similar", "preferred", "considered", "experience", "proficiency",
    "familiar", "familiarity", "with", "using", "including", "etc", "the", "a", "an",
    "solid", "strong", "modern", "framework", "frameworks", "language", "languages",
    "server", "side", "programming", "at", "least", "one", "of", "any",
}


def _canon_skill(token: str) -> str:
    t = normalize_text(token)
    t = t.replace(".js", "").replace("nodejs", "node").replace("reactjs", "react")
    t = t.replace("cplusplus", "c++").replace("c plus plus", "c++")
    return t.strip()


def _display_skill(token: str) -> str:
    raw = token.strip().rstrip(",;")
    if not raw:
        return raw
    lower = raw.lower()
    mapping = {
        "nodejs": "Node.js",
        "node.js": "Node.js",
        "node": "Node.js",
        "reactjs": "React",
        "react.js": "React",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "postgres": "PostgreSQL",
        "postgresql": "PostgreSQL",
        "c++": "C++",
        "c#": "C#",
    }
    return mapping.get(lower, raw)


def _tokens_from_or_body(body: str) -> List[str]:
    cleaned = re.sub(r"(?i)\bor\s+similar\b", " ", body)
    cleaned = re.sub(r"(?i)\b(?:preferred|considered)\b", " ", cleaned)
    found: List[str] = []
    seen: set[str] = set()
    for match in _SKILL_TOKEN_RE.finditer(cleaned):
        raw = match.group(0)
        key = _canon_skill(raw)
        if not key or key in _STOP_SKILL_WORDS or len(key) < 2:
            continue
        if key in seen:
            continue
        seen.add(key)
        found.append(_display_skill(raw))
    return found


def extract_or_groups_from_jd(jd_text: str) -> List[List[str]]:
    """Deterministic OR/one-of skill groups from JD wording (LLM-independent)."""
    if not jd_text or not jd_text.strip():
        return []
    groups: List[List[str]] = []
    seen_keys: set[frozenset[str]] = set()

    def _add(tokens: List[str]) -> None:
        if len(tokens) < 2:
            return
        key = frozenset(_canon_skill(t) for t in tokens)
        if len(key) < 2 or key in seen_keys:
            return
        seen_keys.add(key)
        groups.append(tokens)

    for match in _OR_LIST_RE.finditer(jd_text):
        _add(_tokens_from_or_body(match.group("body")))
    for match in _PAREN_OR_RE.finditer(jd_text):
        _add(_tokens_from_or_body(match.group(1)))
    return groups


def merge_or_groups_from_jd(
    requirements: Sequence[TypedRequirement],
    jd_text: str,
) -> List[TypedRequirement]:
    """
    Merge standalone technical_skill rows that the JD lists as one-of alternatives.
    Survives weak LLM extraction that emits Java, Python, Node as separate requireds.
    """
    rows = list(requirements)
    groups = extract_or_groups_from_jd(jd_text)
    if not groups:
        return collapse_or_group_duplicates(rows)

    for group in groups:
        canon = {_canon_skill(t): t for t in group}
        matches: List[TypedRequirement] = []
        others: List[TypedRequirement] = []
        for row in rows:
            if row.category != "technical_skill":
                others.append(row)
                continue
            if row.satisfy_mode == "any":
                existing = {_canon_skill(x) for x in [row.text, *row.alternatives]}
                if existing & set(canon.keys()):
                    merged_labels = [row.text, *row.alternatives]
                    for key, label in canon.items():
                        if key not in existing:
                            merged_labels.append(label)
                    primary = merged_labels[0]
                    alts = [x for x in merged_labels[1:] if _canon_skill(x) != _canon_skill(primary)]
                    others.append(
                        row.model_copy(
                            update={
                                "text": primary,
                                "alternatives": alts,
                                "satisfy_mode": "any",
                            }
                        )
                    )
                else:
                    others.append(row)
                continue
            key = _canon_skill(row.text)
            if key in canon:
                matches.append(row)
            else:
                others.append(row)

        already_merged = any(
            r.satisfy_mode == "any"
            and ({_canon_skill(x) for x in [r.text, *r.alternatives]} & set(canon.keys()))
            for r in others
        )
        if len(matches) < 2 and already_merged:
            rows = others
            continue

        if len(matches) == 1:
            primary_row = matches[0]
            primary = primary_row.text
            alts = [canon[k] for k in canon if k != _canon_skill(primary)]
            others.append(
                primary_row.model_copy(
                    update={
                        "alternatives": alts,
                        "satisfy_mode": "any",
                    }
                )
            )
            rows = others
            continue

        if len(matches) >= 2:
            primary_row = matches[0]
            ordered = [primary_row.text]
            seen = {_canon_skill(primary_row.text)}
            for label in group:
                key = _canon_skill(label)
                if key not in seen:
                    ordered.append(label)
                    seen.add(key)
            for row in matches[1:]:
                key = _canon_skill(row.text)
                if key not in seen:
                    ordered.append(row.text)
                    seen.add(key)
            others.append(
                primary_row.model_copy(
                    update={
                        "text": ordered[0],
                        "alternatives": ordered[1:],
                        "satisfy_mode": "any",
                        "importance": "required",
                        "funnel_stage": primary_row.funnel_stage or "ats_filter",
                        "weight": max(r.weight for r in matches),
                    }
                )
            )
            rows = others
            continue

        rows = matches + others

    return collapse_or_group_duplicates(rows)


def demote_skills_from_preferred_section(
    requirements: Sequence[TypedRequirement],
    jd_text: str,
) -> List[TypedRequirement]:
    """If a skill appears only under Preferred/Nice-to-have, force importance preferred."""
    match = _PREFERRED_SECTION_RE.search(jd_text or "")
    if not match:
        return list(requirements)
    preferred_blob = match.group(1).lower()
    required_blob = jd_text[: match.start()].lower()

    out: List[TypedRequirement] = []
    for row in requirements:
        if row.category != "technical_skill" or row.importance != "required":
            out.append(row)
            continue
        labels = [row.text, *row.alternatives]
        keys = [_canon_skill(label) for label in labels if _canon_skill(label)]
        if not keys:
            out.append(row)
            continue
        in_pref = all(key in preferred_blob for key in keys)
        in_req = any(key in required_blob for key in keys)
        if in_pref and not in_req:
            out.append(
                row.model_copy(
                    update={
                        "importance": "preferred",
                        "funnel_stage": "hm_review",
                        "weight": min(row.weight, 0.04),
                        "is_hard_gate": False,
                    }
                )
            )
        else:
            out.append(row)
    return out


def reconcile_experience_band_from_jd(
    requirements: Sequence[TypedRequirement],
    jd_text: str,
) -> List[TypedRequirement]:
    """Rewrite experience rows to match the JD's literal years band (e.g. 1-2, not 2+)."""
    if not jd_text.strip():
        return list(requirements)
    range_match = re.search(
        r"(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)",
        jd_text,
        re.I,
    )
    band_text: Optional[str] = None
    if range_match:
        lo, hi = range_match.group(1), range_match.group(2)
        band_text = f"{lo}–{hi} years of professional software engineering experience"
    else:
        min_match = re.search(
            r"(?:at\s+least|minimum\s+of)\s+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)",
            jd_text,
            re.I,
        )
        if min_match:
            band_text = (
                f"{min_match.group(1)}+ years of professional software engineering experience"
            )
    if not band_text:
        return list(requirements)

    out: List[TypedRequirement] = []
    replaced = False
    for row in requirements:
        if (
            not replaced
            and row.category in ("experience", "seniority")
            and parse_years_from_text(row.text) is not None
        ):
            out.append(row.model_copy(update={"text": band_text}))
            replaced = True
        else:
            out.append(row)
    return out


def normalize_typed_requirements(raw_rows: Sequence[Any]) -> List[TypedRequirement]:
    rows: List[TypedRequirement] = []
    seen: set[str] = set()
    for idx, raw in enumerate(raw_rows):
        if not isinstance(raw, dict):
            continue
        text = str(raw.get("text") or raw.get("requirement") or "").strip()
        if not text:
            continue
        category = str(raw.get("category") or "technical_skill").strip().lower()
        if category not in VALID_CATEGORIES:
            category = "technical_skill"
        importance = str(raw.get("importance") or "required").strip().lower()
        if importance not in VALID_IMPORTANCE:
            importance = "required"
        strictness = str(raw.get("strictness") or "flexible").strip().lower()
        if strictness not in VALID_STRICTNESS:
            strictness = "flexible"
        stage = str(raw.get("funnel_stage") or "hm_review").strip().lower()
        if stage not in VALID_STAGES:
            stage = "hm_review"
        satisfy_mode = str(raw.get("satisfy_mode") or "all").strip().lower()
        if satisfy_mode not in VALID_SATISFY_MODES:
            satisfy_mode = "all"
        alternatives = _normalize_alternatives(raw.get("alternatives"))
        # If alternatives exist without any-mode, treat as OR group.
        if alternatives and satisfy_mode == "all":
            satisfy_mode = "any"
        weight = raw.get("weight", _default_weight(category, importance))
        if not isinstance(weight, (int, float)):
            weight = _default_weight(category, importance)
        is_hard_gate = bool(raw.get("is_hard_gate", False)) or (
            importance == "required" and strictness == "hard" and category in HARD_GATE_CATEGORIES
        )
        key = _dedupe_key(category, text, alternatives, satisfy_mode)
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            TypedRequirement(
                id=str(raw.get("id") or f"req_{idx + 1}")[:80],
                category=category,  # type: ignore[arg-type]
                text=text[:240],
                alternatives=alternatives,
                satisfy_mode=satisfy_mode,  # type: ignore[arg-type]
                importance=importance,  # type: ignore[arg-type]
                strictness=strictness,  # type: ignore[arg-type]
                funnel_stage=stage,  # type: ignore[arg-type]
                weight=max(0.01, min(1.0, float(weight))),
                is_hard_gate=is_hard_gate,
            )
        )
    return collapse_or_group_duplicates(rows)


def fallback_typed_requirements(required_skills: Sequence[str], nice_to_have_skills: Sequence[str]) -> List[TypedRequirement]:
    raw: List[Dict[str, Any]] = []
    for idx, skill in enumerate(required_skills):
        if isinstance(skill, str) and skill.strip():
            raw.append(
                {
                    "id": f"req_skill_{idx + 1}",
                    "category": "technical_skill",
                    "text": skill.strip(),
                    "importance": "required",
                    "strictness": "flexible",
                    "funnel_stage": "ats_filter",
                    "weight": 0.08,
                }
            )
    for idx, skill in enumerate(nice_to_have_skills):
        if isinstance(skill, str) and skill.strip():
            raw.append(
                {
                    "id": f"req_bonus_skill_{idx + 1}",
                    "category": "technical_skill",
                    "text": skill.strip(),
                    "importance": "preferred",
                    "strictness": "flexible",
                    "funnel_stage": "hm_review",
                    "weight": 0.03,
                }
            )
    return normalize_typed_requirements(raw)


def parse_years_from_text(text: str) -> Optional[float]:
    if not text:
        return None
    minimum_match = re.search(
        r"(?:at\s+least|minimum\s+of)\s+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)",
        text,
        re.I,
    )
    if minimum_match:
        return float(minimum_match.group(1))
    range_match = re.search(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)", text, re.I)
    if range_match:
        return float(range_match.group(1))
    match = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)", text, re.I)
    return float(match.group(1)) if match else None


def extract_experience_requirements_from_jd(jd_text: str, limit: int = 2) -> List[str]:
    if not jd_text.strip():
        return []
    found: List[str] = []
    seen: set[str] = set()
    for sentence in re.split(r"(?<=[.!?\n])\s+|[\n;]+", jd_text):
        snippet = sentence.strip()
        if not snippet or parse_years_from_text(snippet) is None:
            continue
        key = normalize_text(snippet)[:120]
        if key in seen:
            continue
        seen.add(key)
        found.append(snippet[:240])
        if len(found) >= limit:
            break
    return found


def _has_experience_years_requirement(requirements: Sequence[TypedRequirement]) -> bool:
    return any(
        req.category in ("experience", "seniority") and parse_years_from_text(req.text) is not None
        for req in requirements
    )


def _seniority_from_role(target_role: str) -> Optional[str]:
    text = target_role.lower()
    for level in ("principal", "staff", "lead", "senior", "director", "junior", "intern", "mid"):
        if level in text:
            return level
    return None


def ensure_experience_requirements(
    requirements: List[TypedRequirement],
    jd_text: str,
    target_role: str,
) -> List[TypedRequirement]:
    rows = list(requirements)
    if _has_experience_years_requirement(rows):
        return rows

    jd_snippets = extract_experience_requirements_from_jd(jd_text)
    if jd_snippets:
        snippet = jd_snippets[0]
        range_match = re.search(
            r"(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)",
            snippet,
            re.I,
        )
        if range_match:
            text = (
                f"{range_match.group(1)}–{range_match.group(2)} years of "
                "professional software engineering experience"
            )
        else:
            years = parse_years_from_text(snippet)
            text = (
                f"{years:g}+ years of professional software engineering experience"
                if years is not None
                else snippet[:120]
            )
        rows.append(
            TypedRequirement(
                id="req_exp_jd_scan",
                category="experience",
                text=text,
                importance="required",
                strictness="flexible",
                funnel_stage="recruiter_screen",
                weight=0.1,
                is_hard_gate=False,
            )
        )
        return rows

    seniority = _seniority_from_role(target_role)
    if seniority and not any(req.category == "seniority" for req in rows):
        rows.append(
            TypedRequirement(
                id="req_seniority_role",
                category="seniority",
                text=f"{seniority.title()} level role",
                importance="required",
                strictness="flexible",
                funnel_stage="recruiter_screen",
                weight=0.08,
                is_hard_gate=False,
            )
        )
        return rows

    if not rows:
        rows.append(
            TypedRequirement(
                id="req_role_alignment",
                category="experience",
                text=f"Relevant experience for {target_role}",
                importance="required",
                strictness="flexible",
                funnel_stage="recruiter_screen",
                weight=0.1,
                is_hard_gate=False,
            )
        )
    return rows


def pick_experience_years_alignment(
    alignments: Sequence[RequirementAlignmentV2],
) -> Optional[RequirementAlignmentV2]:
    for row in alignments:
        if row.requirement.category == "experience" and parse_years_from_text(row.requirement.text) is not None:
            return row
    return None


def _default_weight(category: str, importance: str) -> float:
    base = {
        "technical_skill": 0.08,
        "experience": 0.1,
        "education": 0.08,
        "certification": 0.08,
        "domain": 0.06,
        "seniority": 0.08,
        "location": 0.06,
        "work_authorization": 0.08,
        "management": 0.07,
    }.get(category, 0.05)
    return base * IMPORTANCE_WEIGHT.get(importance, 1.0)
