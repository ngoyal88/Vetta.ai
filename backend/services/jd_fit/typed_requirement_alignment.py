"""Typed JD requirement alignment and scoring for JD Fit V2."""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from services.jd_fit.candidate_graph import CandidateIntelligenceGraph
from services.jd_fit.funnel_scoring import years_match_score
from services.jd_fit.jd_fit_models import (
    CategoryScore,
    GateStatus,
    HardGateFinding,
    RequirementAlignment,
    RequirementAlignmentV2,
    RequirementCategory,
    RequirementCategoryGroup,
    RequirementAlignmentStatus,
    SemanticAlignmentResult,
    TypedRequirement,
)
from services.jd_fit.jd_fit_weights import SENIORITY_RANK
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

STATUS_SCORE = {
    "met": 1.0,
    "partial": 0.6,
    "missing": 0.0,
    "unknown": 0.35,
    "not_applicable": 1.0,
}

IMPORTANCE_WEIGHT = {
    "required": 1.25,
    "preferred": 0.8,
    "bonus": 0.35,
}

DEGREE_LEVELS = {
    "phd": 5,
    "doctorate": 5,
    "doctoral": 5,
    "master": 4,
    "masters": 4,
    "ms": 4,
    "m.s": 4,
    "mba": 4,
    "bachelor": 3,
    "bachelors": 3,
    "bs": 3,
    "b.s": 3,
    "ba": 3,
    "b.a": 3,
    "btech": 3,
    "b.tech": 3,
    "associate": 2,
    "diploma": 1,
}

HARD_GATE_CATEGORIES = {
    "work_authorization",
    "location",
    "certification",
    "language",
    "travel",
    "employment_type",
}


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
        weight = raw.get("weight", _default_weight(category, importance))
        if not isinstance(weight, (int, float)):
            weight = _default_weight(category, importance)
        is_hard_gate = bool(raw.get("is_hard_gate", False)) or (
            importance == "required" and strictness == "hard" and category in HARD_GATE_CATEGORIES
        )
        key = f"{category}:{normalize_text(text)}"
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            TypedRequirement(
                id=str(raw.get("id") or f"req_{idx + 1}")[:80],
                category=category,  # type: ignore[arg-type]
                text=text[:240],
                importance=importance,  # type: ignore[arg-type]
                strictness=strictness,  # type: ignore[arg-type]
                funnel_stage=stage,  # type: ignore[arg-type]
                weight=max(0.01, min(1.0, float(weight))),
                is_hard_gate=is_hard_gate,
            )
        )
    return rows[:20]


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
        return rows[:20]

    jd_snippets = extract_experience_requirements_from_jd(jd_text)
    if jd_snippets:
        rows.append(
            TypedRequirement(
                id="req_exp_jd_scan",
                category="experience",
                text=jd_snippets[0],
                importance="required",
                strictness="flexible",
                funnel_stage="recruiter_screen",
                weight=0.1,
                is_hard_gate=False,
            )
        )
        return rows[:20]

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
        return rows[:20]

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
    return rows[:20]


def pick_experience_years_alignment(
    alignments: Sequence[RequirementAlignmentV2],
) -> Optional[RequirementAlignmentV2]:
    for row in alignments:
        if row.requirement.category == "experience" and parse_years_from_text(row.requirement.text) is not None:
            return row
    return None


def align_typed_requirements(
    *,
    requirements: Sequence[TypedRequirement],
    cig: CandidateIntelligenceGraph,
    semantic_alignment: SemanticAlignmentResult,
) -> List[RequirementAlignmentV2]:
    skill_rows = _skill_alignment_map(semantic_alignment.requirements)
    out: List[RequirementAlignmentV2] = []
    for req in requirements:
        if req.category == "technical_skill":
            out.append(_align_technical(req, skill_rows, cig))
        elif req.category == "education":
            out.append(_align_education(req, cig))
        elif req.category == "experience":
            out.append(_align_experience(req, cig))
        elif req.category == "seniority":
            out.append(_align_seniority(req, cig))
        elif req.category == "location":
            out.append(_align_location(req, cig))
        elif req.category == "certification":
            out.append(_align_keyword_category(req, cig, "certification"))
        elif req.category == "domain":
            out.append(_align_keyword_category(req, cig, "domain"))
        elif req.category == "management":
            out.append(_align_management(req, cig))
        elif req.category in {"work_authorization", "language", "travel", "employment_type"}:
            out.append(_align_explicit_unknown_or_keyword(req, cig))
        else:
            out.append(_align_keyword_category(req, cig, req.category))
    return out


def summarize_v2_alignment(
    alignments: Sequence[RequirementAlignmentV2],
) -> Tuple[List[CategoryScore], GateStatus, List[HardGateFinding], List[str], List[str], List[str], int]:
    category_scores = _category_scores(alignments)
    gate_status, hard_gates = _gate_summary(alignments)
    unknowns = [
        f"{row.requirement.text}: not shown in your profile"
        for row in alignments
        if row.status == "unknown"
    ][:8]
    reducers = [
        f"{row.requirement.text}: {row.reason or 'required evidence is missing'}"
        for row in alignments
        if row.status in ("missing", "unknown")
    ][:8]
    strengths = [
        f"{row.requirement.text}: {row.reason or 'matched with profile evidence'}"
        for row in alignments
        if row.status == "met"
    ][:8]
    weighted_score = _weighted_score(alignments)
    return category_scores, gate_status, hard_gates, unknowns, reducers, strengths, weighted_score


def legacy_alignments_from_v2(alignments: Sequence[RequirementAlignmentV2]) -> List[RequirementAlignment]:
    rows: List[RequirementAlignment] = []
    for row in alignments:
        status = {
            "met": "strong",
            "partial": "partial",
            "missing": "missing",
            "unknown": "unclear",
            "not_applicable": "strong",
        }.get(row.status, "unclear")
        rows.append(
            RequirementAlignment(
                jd_requirement=row.requirement.text,
                match_status=status,  # type: ignore[arg-type]
                confidence=row.confidence,
                resume_evidence=row.evidence,
                equivalent_terms_found=[],
            )
        )
    return rows


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


def _skill_alignment_map(rows: Sequence[RequirementAlignment]) -> Dict[str, RequirementAlignment]:
    return {normalize_text(row.jd_requirement): row for row in rows}


def _align_technical(
    req: TypedRequirement,
    skill_rows: Dict[str, RequirementAlignment],
    cig: CandidateIntelligenceGraph,
) -> RequirementAlignmentV2:
    key = normalize_text(req.text)
    row = skill_rows.get(key)
    if not row:
        for candidate_key, candidate_row in skill_rows.items():
            if key in candidate_key or candidate_key in key:
                row = candidate_row
                break
    if row:
        status: RequirementAlignmentStatus = {
            "strong": "met",
            "partial": "partial",
            "missing": "missing",
            "unclear": "unknown",
        }.get(row.match_status, "unknown")  # type: ignore[assignment]
        return RequirementAlignmentV2(
            requirement=req,
            status=status,
            confidence=row.confidence,
            evidence=row.resume_evidence,
            reason=_reason_for_status(status, "technical evidence"),
        )
    if _contains_text(cig.resume_corpus, req.text):
        return RequirementAlignmentV2(
            requirement=req,
            status="partial",
            confidence=0.55,
            evidence=_snippet(cig.resume_corpus, req.text),
            reason="Term appears in resume, but semantic evidence depth is unclear",
        )
    return RequirementAlignmentV2(requirement=req, status="missing", confidence=0.45, reason="Skill is not visible in resume")


def _align_education(req: TypedRequirement, cig: CandidateIntelligenceGraph) -> RequirementAlignmentV2:
    if not cig.education:
        return RequirementAlignmentV2(requirement=req, status="unknown", confidence=0.45, reason="Education is not shown in profile")
    req_level = _degree_level(req.text)
    best_text = _join_education(cig.education)
    candidate_level = _degree_level(best_text)
    if req_level and candidate_level >= req_level:
        return RequirementAlignmentV2(requirement=req, status="met", confidence=0.82, evidence=best_text[:260], reason="Education level appears to meet the JD")
    if req_level and candidate_level:
        return RequirementAlignmentV2(requirement=req, status="partial", confidence=0.62, evidence=best_text[:260], reason="Education is present but may not meet the requested level")
    if _contains_text(best_text, req.text):
        return RequirementAlignmentV2(requirement=req, status="met", confidence=0.75, evidence=best_text[:260], reason="Education requirement appears in profile")
    if "equivalent" in req.text.lower() and cig.years_experience and cig.years_experience >= 4:
        return RequirementAlignmentV2(requirement=req, status="partial", confidence=0.64, evidence=f"{cig.years_experience:g} years experience", reason="JD allows equivalent experience")
    return RequirementAlignmentV2(requirement=req, status="unknown", confidence=0.5, evidence=best_text[:260], reason="Education is present but exact JD match is unclear")


def _align_experience(req: TypedRequirement, cig: CandidateIntelligenceGraph) -> RequirementAlignmentV2:
    required_years = parse_years_from_text(req.text)
    if required_years is not None:
        if cig.years_experience is None:
            return RequirementAlignmentV2(requirement=req, status="unknown", confidence=0.45, reason="Years of experience are not shown in profile")
        evidence = f"{cig.years_experience:g} years experience"
        years_score = years_match_score(required_years, cig.years_experience)
        if years_score is None:
            return RequirementAlignmentV2(requirement=req, status="unknown", confidence=0.45, reason="Years of experience are not shown in profile")
        if years_score >= 1.0:
            return RequirementAlignmentV2(requirement=req, status="met", confidence=0.84, evidence=evidence, reason="Years of experience meet the JD")
        if years_score >= 0.6:
            return RequirementAlignmentV2(requirement=req, status="partial", confidence=0.64, evidence=evidence, reason="Experience is close to the JD requirement")
        return RequirementAlignmentV2(requirement=req, status="missing", confidence=0.7, evidence=evidence, reason="Years of experience are below the JD requirement")
    return _align_keyword_category(req, cig, "experience")


def _align_seniority(req: TypedRequirement, cig: CandidateIntelligenceGraph) -> RequirementAlignmentV2:
    text = req.text.lower()
    level = next((lvl for lvl in SENIORITY_RANK if lvl in text and lvl not in {"unknown", "middle"}), None)
    if not level:
        return _align_keyword_category(req, cig, "seniority")
    candidate = SENIORITY_RANK.get(cig.seniority_level, 2)
    target = SENIORITY_RANK.get(level, 2)
    if candidate >= target:
        return RequirementAlignmentV2(requirement=req, status="met", confidence=0.78, evidence=cig.seniority_level, reason="Seniority signal meets the JD")
    if candidate == target - 1:
        return RequirementAlignmentV2(requirement=req, status="partial", confidence=0.6, evidence=cig.seniority_level, reason="Seniority signal is close but not exact")
    return RequirementAlignmentV2(requirement=req, status="missing", confidence=0.62, evidence=cig.seniority_level, reason="Seniority signal appears below the JD")


def _align_location(req: TypedRequirement, cig: CandidateIntelligenceGraph) -> RequirementAlignmentV2:
    locations = [loc for loc in [cig.profile_location, *cig.experience_locations] if loc]
    if not locations:
        return RequirementAlignmentV2(requirement=req, status="unknown", confidence=0.45, reason="Location/work mode is not shown in profile")
    joined = "; ".join(locations)
    if _any_token_overlap(req.text, joined):
        return RequirementAlignmentV2(requirement=req, status="met", confidence=0.72, evidence=joined[:260], reason="Location signal appears aligned")
    if any(term in req.text.lower() for term in ("remote", "hybrid", "onsite", "on-site")):
        return RequirementAlignmentV2(requirement=req, status="unknown", confidence=0.48, evidence=joined[:260], reason="Work mode preference is not shown in profile")
    return RequirementAlignmentV2(requirement=req, status="partial", confidence=0.52, evidence=joined[:260], reason="Location exists, but exact JD location match is unclear")


def _align_management(req: TypedRequirement, cig: CandidateIntelligenceGraph) -> RequirementAlignmentV2:
    corpus = cig.resume_corpus
    if re.search(r"\b(led|lead|managed|mentored|hired|coached|team|stakeholder)\b", corpus, re.I):
        return RequirementAlignmentV2(requirement=req, status="partial", confidence=0.62, evidence=_first_matching_sentence(corpus, ("led", "managed", "team", "mentored")), reason="Leadership terms appear in resume")
    return RequirementAlignmentV2(requirement=req, status="unknown", confidence=0.45, reason="Management scope is not clearly shown in profile")


def _align_explicit_unknown_or_keyword(req: TypedRequirement, cig: CandidateIntelligenceGraph) -> RequirementAlignmentV2:
    if _contains_text(cig.resume_corpus, req.text):
        return RequirementAlignmentV2(requirement=req, status="met", confidence=0.72, evidence=_snippet(cig.resume_corpus, req.text), reason="Requirement appears explicitly in profile")
    return RequirementAlignmentV2(requirement=req, status="unknown", confidence=0.42, reason=f"{req.category.replace('_', ' ')} is not shown in profile")


def _align_keyword_category(req: TypedRequirement, cig: CandidateIntelligenceGraph, category: str) -> RequirementAlignmentV2:
    haystacks = [cig.resume_corpus, " ".join(cig.project_summaries)]
    joined = " ".join(haystacks)
    if _contains_text(joined, req.text) or _any_token_overlap(req.text, joined):
        return RequirementAlignmentV2(requirement=req, status="partial", confidence=0.58, evidence=_first_matching_sentence(joined, tuple(req.text.split()[:5])), reason=f"{category.replace('_', ' ')} evidence appears related")
    return RequirementAlignmentV2(requirement=req, status="unknown" if req.category not in {"technical_skill"} else "missing", confidence=0.45, reason=f"{category.replace('_', ' ')} evidence is not clearly shown")


def _category_scores(alignments: Sequence[RequirementAlignmentV2]) -> List[CategoryScore]:
    by_group: Dict[str, List[RequirementAlignmentV2]] = {}
    for row in alignments:
        group = CATEGORY_GROUPS.get(row.requirement.category, "resume_signal")
        by_group.setdefault(group, []).append(row)
    scores: List[CategoryScore] = []
    for group, rows in by_group.items():
        score = round(sum(STATUS_SCORE[row.status] for row in rows) / max(1, len(rows)) * 100)
        scores.append(
            CategoryScore(
                category=group,  # type: ignore[arg-type]
                score=max(0, min(100, score)),
                met=sum(1 for r in rows if r.status == "met"),
                partial=sum(1 for r in rows if r.status == "partial"),
                missing=sum(1 for r in rows if r.status == "missing"),
                unknown=sum(1 for r in rows if r.status == "unknown"),
            )
        )
    order = ["technical", "experience", "education", "certifications", "domain", "logistics", "leadership", "resume_signal"]
    return sorted(scores, key=lambda item: order.index(item.category) if item.category in order else 99)


def _gate_summary(alignments: Sequence[RequirementAlignmentV2]) -> Tuple[GateStatus, List[HardGateFinding]]:
    findings: List[HardGateFinding] = []
    status: GateStatus = "clear"
    for row in alignments:
        if not row.requirement.is_hard_gate:
            continue
        if row.status == "missing":
            status = "blocked"
            findings.append(HardGateFinding(requirement=row.requirement.text, status=row.status, category=row.requirement.category, reason=row.reason))
        elif row.status == "unknown" and status != "blocked":
            status = "risky"
            findings.append(HardGateFinding(requirement=row.requirement.text, status=row.status, category=row.requirement.category, reason=row.reason))
    return status, findings[:8]


def _weighted_score(alignments: Sequence[RequirementAlignmentV2]) -> int:
    rows = [row for row in alignments if row.status != "not_applicable"]
    if not rows:
        return 35
    total_weight = 0.0
    score = 0.0
    for row in rows:
        weight = row.requirement.weight * IMPORTANCE_WEIGHT.get(row.requirement.importance, 1.0)
        total_weight += weight
        score += STATUS_SCORE[row.status] * weight
    return max(0, min(100, int(round((score / max(total_weight, 0.01)) * 100))))


def _reason_for_status(status: RequirementAlignmentStatus, noun: str) -> str:
    if status == "met":
        return f"Matched with {noun}"
    if status == "partial":
        return f"Partially matched with {noun}"
    if status == "missing":
        return f"Missing clear {noun}"
    return f"{noun.capitalize()} is not shown clearly enough"


def _degree_level(text: str) -> int:
    norm = normalize_text(text)
    return max((level for key, level in DEGREE_LEVELS.items() if re.search(rf"\b{re.escape(key)}\b", norm)), default=0)


def _join_education(education: Sequence[Dict[str, Any]]) -> str:
    rows: List[str] = []
    for item in education:
        bits = [item.get("school") or item.get("institution"), item.get("degree"), item.get("field_of_study") or item.get("major")]
        line = ", ".join(str(bit).strip() for bit in bits if bit)
        if line:
            rows.append(line)
    return "; ".join(rows)


def _contains_text(corpus: str, needle: str) -> bool:
    key = normalize_text(needle)
    if not key:
        return False
    if key in normalize_text(corpus):
        return True
    tokens = [token for token in key.split() if len(token) > 2]
    return bool(tokens) and all(token in normalize_text(corpus) for token in tokens[:4])


def _any_token_overlap(a: str, b: str) -> bool:
    a_tokens = {tok for tok in re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", a.lower()) if tok not in {"the", "and", "with", "for", "must", "have"}}
    b_tokens = set(re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", b.lower()))
    return bool(a_tokens.intersection(b_tokens))


def _snippet(corpus: str, needle: str) -> Optional[str]:
    return _first_matching_sentence(corpus, tuple(needle.split()[:5]))


def _first_matching_sentence(corpus: str, tokens: Iterable[str]) -> Optional[str]:
    wanted = [normalize_text(token) for token in tokens if len(token) > 2]
    if not wanted:
        return None
    for sentence in re.split(r"(?<=[.!?])\s+|[\n;]+", corpus):
        norm = normalize_text(sentence)
        if any(token in norm for token in wanted):
            return sentence.strip()[:260]
    return None
