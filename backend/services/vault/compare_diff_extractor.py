"""Deterministic resume A vs B diff extraction for vault compare."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from services.resume.scorecard_service import normalize_resume_for_scorecard

SECTION_ORDER = ("summary", "skills", "experience", "projects")
SECTION_LABELS = {
    "summary": "Summary",
    "skills": "Skills",
    "experience": "Experience",
    "projects": "Projects",
}


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_summary(profile: Dict[str, Any]) -> str:
    summary = profile.get("summary")
    if isinstance(summary, str):
        return summary.strip()
    if isinstance(summary, dict):
        return _safe_str(summary.get("text") or summary.get("content"))
    return ""


def _job_key(entry: Dict[str, Any]) -> str:
    title = _safe_str(entry.get("title"))
    company = _safe_str(entry.get("company"))
    return f"{company}::{title}".lower()


def _project_key(entry: Dict[str, Any]) -> str:
    return _safe_str(entry.get("name")).lower()


def _bullet_map(responsibilities: List[str]) -> Dict[str, str]:
    """Map normalized bullet text to original casing."""
    out: Dict[str, str] = {}
    for bullet in responsibilities:
        text = bullet.strip() if isinstance(bullet, str) else ""
        if not text:
            continue
        out[text.lower()] = text
    return out


def _format_job_label(entry: Dict[str, Any]) -> str:
    title = _safe_str(entry.get("title"))
    company = _safe_str(entry.get("company"))
    if company and title:
        return f"{title} at {company}"
    return title or company or "Role"


def _format_project_label(entry: Dict[str, Any]) -> str:
    name = _safe_str(entry.get("name"))
    if name:
        return name
    desc = _safe_str(entry.get("description"))
    return desc[:80] + ("…" if len(desc) > 80 else "") if desc else "Project"


def _truncate(text: str, limit: int = 280) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


def _summaries_differ(a: str, b: str) -> bool:
    if not a and not b:
        return False
    if not a or not b:
        return True
    norm_a = re.sub(r"\s+", " ", a).strip().lower()
    norm_b = re.sub(r"\s+", " ", b).strip().lower()
    if norm_a == norm_b:
        return False
    # Treat as same if one is a substring of the other and lengths are close.
    shorter, longer = (norm_a, norm_b) if len(norm_a) <= len(norm_b) else (norm_b, norm_a)
    if shorter in longer and len(longer) - len(shorter) < 40:
        return False
    return True


def _diff_skills(profile_a: Dict[str, Any], profile_b: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    norm_a = normalize_resume_for_scorecard(profile_a)
    norm_b = normalize_resume_for_scorecard(profile_b)
    skills_a = {s.lower(): s for s in (norm_a.get("skills") or []) if isinstance(s, str) and s.strip()}
    skills_b = {s.lower(): s for s in (norm_b.get("skills") or []) if isinstance(s, str) and s.strip()}
    only_a = sorted(skills_a[k] for k in skills_a if k not in skills_b)
    only_b = sorted(skills_b[k] for k in skills_b if k not in skills_a)
    return only_a, only_b


def _diff_experience(
    profile_a: Dict[str, Any], profile_b: Dict[str, Any]
) -> Tuple[List[str], List[str], List[Dict[str, str]]]:
    norm_a = normalize_resume_for_scorecard(profile_a)
    norm_b = normalize_resume_for_scorecard(profile_b)
    jobs_a = { _job_key(j): j for j in (norm_a.get("work_experience") or []) if _job_key(j) != "::" }
    jobs_b = { _job_key(j): j for j in (norm_b.get("work_experience") or []) if _job_key(j) != "::" }

    only_in_a: List[str] = []
    only_in_b: List[str] = []
    changed: List[Dict[str, str]] = []

    for key, job in jobs_a.items():
        if key not in jobs_b:
            label = _format_job_label(job)
            bullets = job.get("responsibilities") or []
            if bullets:
                only_in_a.extend(f"{label}: {b}" for b in bullets[:3])
            else:
                only_in_a.append(label)
            continue
        other = jobs_b[key]
        map_a = _bullet_map(job.get("responsibilities") or [])
        map_b = _bullet_map(other.get("responsibilities") or [])
        keys_a = set(map_a.keys())
        keys_b = set(map_b.keys())
        removed_keys = sorted(keys_a - keys_b)
        added_keys = sorted(keys_b - keys_a)
        label = _format_job_label(job)
        only_in_a.extend(f"{label}: {map_a[k]}" for k in removed_keys[:5])
        only_in_b.extend(f"{label}: {map_b[k]}" for k in added_keys[:5])
        if removed_keys and added_keys:
            changed.append(
                {
                    "label": label,
                    "before": map_a[removed_keys[0]],
                    "after": map_b[added_keys[0]],
                }
            )

    for key, job in jobs_b.items():
        if key not in jobs_a:
            label = _format_job_label(job)
            bullets = job.get("responsibilities") or []
            if bullets:
                only_in_b.extend(f"{label}: {b}" for b in bullets[:3])
            else:
                only_in_b.append(label)

    return only_in_a, only_in_b, changed


def _diff_projects(
    profile_a: Dict[str, Any], profile_b: Dict[str, Any]
) -> Tuple[List[str], List[str], List[Dict[str, str]]]:
    norm_a = normalize_resume_for_scorecard(profile_a)
    norm_b = normalize_resume_for_scorecard(profile_b)
    proj_a = { _project_key(p): p for p in (norm_a.get("projects") or []) if _project_key(p) }
    proj_b = { _project_key(p): p for p in (norm_b.get("projects") or []) if _project_key(p) }

    only_in_a: List[str] = []
    only_in_b: List[str] = []
    changed: List[Dict[str, str]] = []

    for key, proj in proj_a.items():
        if key not in proj_b:
            only_in_a.append(_format_project_item(proj))
            continue
        other = proj_b[key]
        desc_a = _safe_str(proj.get("description"))
        desc_b = _safe_str(other.get("description"))
        if desc_a and desc_b and desc_a.lower() != desc_b.lower():
            changed.append(
                {
                    "label": _format_project_label(proj),
                    "before": _truncate(desc_a),
                    "after": _truncate(desc_b),
                }
            )
        elif desc_a and not desc_b:
            only_in_a.append(f"{_format_project_label(proj)}: {_truncate(desc_a)}")
        elif desc_b and not desc_a:
            only_in_b.append(f"{_format_project_label(other)}: {_truncate(desc_b)}")

    for key, proj in proj_b.items():
        if key not in proj_a:
            only_in_b.append(_format_project_item(proj))

    return only_in_a, only_in_b, changed


def _format_project_item(proj: Dict[str, Any]) -> str:
    label = _format_project_label(proj)
    desc = _safe_str(proj.get("description"))
    tech = proj.get("tech_stack") or []
    tech_str = ", ".join(t for t in tech if isinstance(t, str) and t.strip())
    parts = [label]
    if desc:
        parts.append(_truncate(desc, 120))
    if tech_str:
        parts.append(f"({tech_str})")
    return " — ".join(parts) if len(parts) > 1 else parts[0]


def _diff_summary(
    profile_a: Dict[str, Any], profile_b: Dict[str, Any]
) -> Tuple[List[str], List[str], List[Dict[str, str]]]:
    summary_a = _normalize_summary(profile_a)
    summary_b = _normalize_summary(profile_b)
    if not _summaries_differ(summary_a, summary_b):
        return [], [], []
    if summary_a and summary_b:
        return [], [], [{"label": "Summary", "before": _truncate(summary_a), "after": _truncate(summary_b)}]
    if summary_a:
        return [_truncate(summary_a)], [], []
    if summary_b:
        return [], [_truncate(summary_b)], []
    return [], [], []


def _section_verdict(only_a: List[str], only_b: List[str], changed: List[Dict[str, str]]) -> str:
    if not only_a and not only_b and not changed:
        return "unchanged"
    if only_b and not only_a and changed:
        return "b_stronger"
    if only_a and not only_b and changed:
        return "a_stronger"
    return "mixed"


def extract_section_diffs(
    profile_a: Dict[str, Any],
    profile_b: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Build symmetric section_diffs from profile snapshots."""
    sections: List[Dict[str, Any]] = []

    only_a, only_b, changed = _diff_summary(profile_a, profile_b)
    sections.append(
        _section_row("summary", only_a, only_b, changed)
    )

    skills_a, skills_b = _diff_skills(profile_a, profile_b)
    sections.append(
        _section_row("skills", skills_a, skills_b, [])
    )

    exp_a, exp_b, exp_changed = _diff_experience(profile_a, profile_b)
    sections.append(
        _section_row("experience", exp_a, exp_b, exp_changed)
    )

    proj_a, proj_b, proj_changed = _diff_projects(profile_a, profile_b)
    sections.append(
        _section_row("projects", proj_a, proj_b, proj_changed)
    )

    return [s for s in sections if _section_has_content(s)]


def _section_row(
    section: str,
    only_in_a: List[str],
    only_in_b: List[str],
    changed: List[Dict[str, str]],
) -> Dict[str, Any]:
    return {
        "section": section,
        "label": SECTION_LABELS[section],
        "only_in_a": only_in_a,
        "only_in_b": only_in_b,
        "changed": changed,
        "verdict": _section_verdict(only_in_a, only_in_b, changed),
    }


def _section_has_content(section: Dict[str, Any]) -> bool:
    return bool(section.get("only_in_a") or section.get("only_in_b") or section.get("changed"))


def build_pane_changes(section_diffs: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group only_in_a / only_in_b items per side for pane footers."""
    pane_a: List[Dict[str, Any]] = []
    pane_b: List[Dict[str, Any]] = []

    for row in section_diffs:
        section = row.get("section", "")
        label = row.get("label", section)
        items_a = row.get("only_in_a") or []
        items_b = row.get("only_in_b") or []
        if items_a:
            pane_a.append({"section": section, "label": label, "items": items_a})
        if items_b:
            pane_b.append({"section": section, "label": label, "items": items_b})

    return {"a": pane_a, "b": pane_b}


def merge_llm_changed(
    deterministic: List[Dict[str, Any]],
    llm_sections: Optional[List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """Merge LLM-provided changed rows into deterministic section_diffs."""
    if not llm_sections:
        return deterministic

    llm_by_section: Dict[str, Dict[str, Any]] = {}
    for item in llm_sections:
        if not isinstance(item, dict):
            continue
        section = _safe_str(item.get("section")).lower()
        if section in SECTION_LABELS:
            llm_by_section[section] = item

    merged: List[Dict[str, Any]] = []
    det_by_section = {row["section"]: row for row in deterministic}

    for section in SECTION_ORDER:
        det = det_by_section.get(section)
        llm = llm_by_section.get(section)
        if not det and not llm:
            continue
        if not det:
            llm_changed = _normalize_changed_list(llm.get("changed"))
            if llm_changed:
                only_a = _safe_str_list(llm.get("only_in_a")) if section == "skills" else []
                only_b = _safe_str_list(llm.get("only_in_b")) if section == "skills" else []
                merged.append(
                    {
                        "section": section,
                        "label": SECTION_LABELS[section],
                        "only_in_a": only_a,
                        "only_in_b": only_b,
                        "changed": llm_changed,
                        "verdict": _section_verdict(only_a, only_b, llm_changed),
                    }
                )
            continue
        if not llm:
            merged.append(det)
            continue

        llm_changed = _normalize_changed_list(llm.get("changed"))
        det_changed = det.get("changed") or []
        seen = {(c.get("label", ""), c.get("before", ""), c.get("after", "")) for c in det_changed}
        for row in llm_changed:
            key = (row.get("label", ""), row.get("before", ""), row.get("after", ""))
            if key not in seen:
                det_changed.append(row)
                seen.add(key)

        det["changed"] = det_changed
        # only_in_* lists stay deterministic; LLM contributes changed rows and narrative only
        det["verdict"] = _section_verdict(det.get("only_in_a") or [], det.get("only_in_b") or [], det_changed)
        merged.append(det)

    return [s for s in merged if _section_has_content(s)]


def _safe_str_list(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    return [s for s in (_safe_str(v) for v in values) if s]


def _normalize_changed_list(raw: Any) -> List[Dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        before = _safe_str(item.get("before"))
        after = _safe_str(item.get("after"))
        if not before and not after:
            continue
        out.append(
            {
                "label": _safe_str(item.get("label")) or "Change",
                "before": before,
                "after": after,
            }
        )
    return out


def _normalize_llm_section(item: Dict[str, Any]) -> Dict[str, Any]:
    section = _safe_str(item.get("section")).lower()
    only_a = _safe_str_list(item.get("only_in_a"))
    only_b = _safe_str_list(item.get("only_in_b"))
    changed = _normalize_changed_list(item.get("changed"))
    return {
        "section": section,
        "label": SECTION_LABELS.get(section, section.title()),
        "only_in_a": only_a,
        "only_in_b": only_b,
        "changed": changed,
        "verdict": _section_verdict(only_a, only_b, changed),
    }


def build_diff_summary_fallback(section_diffs: List[Dict[str, Any]]) -> str:
    """Neutral narrative fallback without counts."""
    snippets: List[str] = []
    for row in section_diffs:
        label = row.get("label", row.get("section", ""))
        changed = row.get("changed") or []
        only_a = row.get("only_in_a") or []
        only_b = row.get("only_in_b") or []
        if changed:
            first = changed[0]
            snippets.append(f"{label} was rewritten.")
        elif only_a and only_b:
            snippets.append(f"{label} differs between both resumes.")
        elif only_b:
            snippets.append(f"{label} has content only in resume B.")
        elif only_a:
            snippets.append(f"{label} has content only in resume A.")
        if len(snippets) >= 3:
            break
    if snippets:
        return " ".join(snippets)
    return "No major structural differences detected between the two resumes."


def section_diffs_to_legacy_comparisons(section_diffs: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Map section_diffs to legacy section_comparisons for backward compat."""
    verdict_map = {
        "a_stronger": "regressed",
        "b_stronger": "improved",
        "unchanged": "unchanged",
        "mixed": "mixed",
    }
    rows: List[Dict[str, str]] = []
    for row in section_diffs:
        only_a = row.get("only_in_a") or []
        only_b = row.get("only_in_b") or []
        changed = row.get("changed") or []
        baseline_parts = list(only_a[:5])
        target_parts = list(only_b[:5])
        for c in changed[:2]:
            if c.get("before"):
                baseline_parts.append(c["before"])
            if c.get("after"):
                target_parts.append(c["after"])
        verdict = verdict_map.get(row.get("verdict", "mixed"), "mixed")
        rows.append(
            {
                "section": row["section"],
                "label": row["label"],
                "baseline_summary": "; ".join(baseline_parts) if baseline_parts else "No unique content in resume A.",
                "target_summary": "; ".join(target_parts) if target_parts else "No unique content in resume B.",
                "verdict": verdict,
            }
        )
    return rows
