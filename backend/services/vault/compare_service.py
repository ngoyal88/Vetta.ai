import json
import re
from typing import Any, Dict, List, Optional

from services.interview.llm_engine import get_platform_llm
from services.interview.prompt_contracts import extract_json_dict
from utils.logger import get_logger

logger = get_logger(__name__)
from services.resume.scorecard_service import normalize_resume_for_scorecard, build_resume_scorecard
from services.vault.analysis_service import _compact_resume_text
from services.vault.compare_diff_extractor import (
    SECTION_ORDER as DIFF_SECTION_ORDER,
    _section_row,
    build_diff_summary_fallback,
    build_pane_changes,
    extract_section_diffs,
    merge_llm_changed,
    section_diffs_to_legacy_comparisons,
)

def _skill_set(profile: Dict[str, Any]) -> List[str]:
    normalized = normalize_resume_for_scorecard(profile)
    skills = normalized.get("skills") or []
    return list(dict.fromkeys([s for s in skills if isinstance(s, str) and s.strip()]))


SECTION_ORDER = ("summary", "skills", "experience", "projects")
SECTION_LABELS = {
    "summary": "Summary",
    "skills": "Skills",
    "experience": "Experience",
    "projects": "Projects",
}
VALID_VERDICTS = frozenset({"improved", "regressed", "unchanged", "mixed"})


def _clean_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _normalize_section_comparisons(
    payload: Dict[str, Any],
    section_highlights: Dict[str, str],
    skills_only_in_a: List[str],
    skills_only_in_b: List[str],
) -> List[Dict[str, str]]:
    comparisons: List[Dict[str, str]] = []
    raw = payload.get("section_comparisons")

    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            section = _clean_text(item.get("section")).lower()
            if section not in SECTION_LABELS:
                continue
            baseline = _clean_text(item.get("baseline_summary"))
            target = _clean_text(item.get("target_summary"))
            if not baseline and not target:
                continue
            verdict = _clean_text(item.get("verdict")).lower()
            if verdict not in VALID_VERDICTS:
                verdict = "mixed"
            comparisons.append(
                {
                    "section": section,
                    "label": SECTION_LABELS[section],
                    "baseline_summary": baseline or "No notable differences detected.",
                    "target_summary": target or "No notable differences detected.",
                    "verdict": verdict,
                }
            )

    if comparisons:
        seen = {row["section"] for row in comparisons}
        for section in SECTION_ORDER:
            if section in seen:
                continue
            highlight = section_highlights.get(section)
            if not highlight:
                continue
            comparisons.append(
                {
                    "section": section,
                    "label": SECTION_LABELS[section],
                    "baseline_summary": "See resume A for full content.",
                    "target_summary": highlight,
                    "verdict": "mixed",
                }
            )
        return sorted(comparisons, key=lambda row: SECTION_ORDER.index(row["section"]))

    for section in SECTION_ORDER:
        highlight = section_highlights.get(section, "")
        if section == "skills":
            baseline = ", ".join(skills_only_in_a[:10]) if skills_only_in_a else ""
            target = ", ".join(skills_only_in_b[:10]) if skills_only_in_b else ""
            if baseline or target:
                comparisons.append(
                    {
                        "section": section,
                        "label": SECTION_LABELS[section],
                        "baseline_summary": baseline or "No unique skills in resume A.",
                        "target_summary": target or "No unique skills in resume B.",
                        "verdict": "mixed" if baseline and target else ("improved" if target else "regressed"),
                    }
                )
                continue
        if highlight:
            comparisons.append(
                {
                    "section": section,
                    "label": SECTION_LABELS[section],
                    "baseline_summary": "See resume A document for full content.",
                    "target_summary": highlight,
                    "verdict": "mixed",
                }
            )

    return comparisons


def _compact_summary(profile: Dict[str, Any]) -> str:
    normalized = normalize_resume_for_scorecard(profile)
    skills = normalized.get("skills") or []
    projects = normalized.get("projects") or []
    work = normalized.get("work_experience") or []
    return (
        f"skills={len(skills)} projects={len(projects)} work_experiences={len(work)} "
        f"skills_sample={[s for s in skills[:10]]}"
    )


def _parse_llm_section_diffs(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = payload.get("section_diffs")
    if not isinstance(raw, list):
        return []
    sections: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        section = _clean_text(item.get("section")).lower()
        if section not in SECTION_LABELS:
            continue
        changed: List[Dict[str, str]] = []
        for row in item.get("changed") or []:
            if not isinstance(row, dict):
                continue
            before = _clean_text(row.get("before"))
            after = _clean_text(row.get("after"))
            if before or after:
                changed.append(
                    {
                        "label": _clean_text(row.get("label")) or SECTION_LABELS[section],
                        "before": before,
                        "after": after,
                    }
                )
        only_a = [s for s in (_clean_text(v) for v in (item.get("only_in_a") or [])) if s]
        only_b = [s for s in (_clean_text(v) for v in (item.get("only_in_b") or [])) if s]
        sections.append(
            {
                "section": section,
                "label": SECTION_LABELS[section],
                "only_in_a": only_a,
                "only_in_b": only_b,
                "changed": changed,
            }
        )
    return sections


async def compare_profiles(
    profile_a: Dict[str, Any],
    profile_b: Dict[str, Any],
    role: Optional[str] = None,
) -> Dict[str, Any]:
    score_a = (await build_resume_scorecard(profile_data=profile_a, role_hint=role)).score
    score_b = (await build_resume_scorecard(profile_data=profile_b, role_hint=role)).score

    skills_a = set(_skill_set(profile_a))
    skills_b = set(_skill_set(profile_b))

    delta = score_a - score_b

    deterministic_diffs = extract_section_diffs(profile_a, profile_b)

    system_prompt = (
        "You compare two peer resumes (resume A and resume B) for a role. "
        "Return ONLY JSON with this shape: "
        "{\"recommended_id\":\"a\"|\"b\",\"recommendation_reason\":string,"
        "\"diff_summary\":string,"
        "\"section_diffs\":["
        "{\"section\":\"summary\"|\"skills\"|\"experience\"|\"projects\","
        "\"only_in_a\":[string],\"only_in_b\":[string],"
        "\"changed\":[{\"label\":string,\"before\":string,\"after\":string}]}"
        "]}."
        " diff_summary must be 2-4 sentences describing actual content differences. "
        "Never use counts like '3 skills' or 'N items'. "
        "Describe resume A and resume B as peers — never use baseline or target."
    )
    user_prompt = (
        f"role={role or ''}\n"
        f"resume_a_summary={_compact_summary(profile_a)}\n"
        f"resume_b_summary={_compact_summary(profile_b)}\n"
        f"resume_a_text={_compact_resume_text(profile_a)}\n"
        f"resume_b_text={_compact_resume_text(profile_b)}\n"
        f"score_a={score_a} score_b={score_b}"
    )

    raw = await get_platform_llm().json_completion(system_prompt, user_prompt)
    payload = extract_json_dict(raw)
    if not payload:
        logger.warning("Vault compare LLM returned unparseable JSON; using score-based fallbacks")

    recommended_id = payload.get("recommended_id")
    if recommended_id not in {"a", "b"}:
        recommended_id = "a" if score_a >= score_b else "b"

    reason = payload.get("recommendation_reason")
    if not isinstance(reason, str) or not reason.strip():
        reason = "Recommended based on overall score and skill coverage."

    llm_section_diffs = _parse_llm_section_diffs(payload)
    section_diffs = merge_llm_changed(deterministic_diffs, llm_section_diffs)

    skills_only_in_a = sorted(list(skills_a - skills_b))
    skills_only_in_b = sorted(list(skills_b - skills_a))
    skills_row = next((r for r in section_diffs if r["section"] == "skills"), None)
    if skills_row:
        skills_row["only_in_a"] = skills_only_in_a
        skills_row["only_in_b"] = skills_only_in_b
    elif skills_only_in_a or skills_only_in_b:
        section_diffs.append(_section_row("skills", skills_only_in_a, skills_only_in_b, []))
        section_diffs.sort(key=lambda r: DIFF_SECTION_ORDER.index(r["section"]))

    pane_changes = build_pane_changes(section_diffs)

    diff_summary = payload.get("diff_summary")
    if not isinstance(diff_summary, str) or not diff_summary.strip():
        diff_summary = build_diff_summary_fallback(section_diffs)
    else:
        diff_summary = diff_summary.strip()
        if re.search(r"\b\d+\s+(skills?|items?|projects?|experiences?)\b", diff_summary, re.I):
            diff_summary = build_diff_summary_fallback(section_diffs)

    section_comparisons = section_diffs_to_legacy_comparisons(section_diffs)

    section_highlights = {
        row["section"]: "; ".join((row.get("only_in_b") or [])[:3])
        for row in section_diffs
        if row.get("only_in_b")
    }

    section_verdicts = {
        row["section"]: row.get("verdict", "mixed") for row in section_diffs
    }

    return {
        "score_a": score_a,
        "score_b": score_b,
        "score_delta": delta,
        "skills_only_in_a": skills_only_in_a,
        "skills_only_in_b": skills_only_in_b,
        "recommended_id": recommended_id,
        "recommendation_reason": reason,
        "section_verdicts": section_verdicts,
        "diff_summary": diff_summary,
        "section_highlights": section_highlights,
        "section_comparisons": section_comparisons,
        "section_diffs": section_diffs,
        "pane_changes": pane_changes,
    }
