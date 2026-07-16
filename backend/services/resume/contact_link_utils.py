"""Normalize, validate, and reconcile resume contact/project links."""

from __future__ import annotations

import re
from typing import Iterable, List, Literal, Optional
from urllib.parse import urlparse

from models.resume import ResumeProfile

LinkKind = Literal[
    "github_profile",
    "github_repo",
    "linkedin",
    "leetcode",
    "portfolio",
    "demo",
    "other",
    "invalid",
]

_LINK_LABELS = frozenset(
    {"link", "links", "github", "linkedin", "portfolio", "leetcode", "email", "phone", "website", "blog"}
)
_BARE_PROVIDER_HOSTS = frozenset(
    {"gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com"}
)
_HOSTED_DEPLOY_SUFFIXES = (
    ".vercel.app",
    ".netlify.app",
    ".pages.dev",
    ".herokuapp.com",
    ".onrender.com",
    ".fly.dev",
    ".railway.app",
)
_PORTFOLIO_SIGNALS = ("portfolio", "personal")
_CONTACT_OTHER_HINTS = (
    "leetcode.com",
    "codeforces.com",
    "codechef.com",
    "codolio.com",
    "hackerrank.com",
    "geeksforgeeks.org",
    "code360",
    "kaggle.com",
)

_URL_IN_TEXT_RE = re.compile(
    r"(?:https?://|www\.)[^\s,<>\"')\]]+"
    r"|(?:[a-z0-9][-a-z0-9]*\.)+(?:com|app|io|dev|me|org|net|co|in|xyz|edu|git)(?:/[^\s,]*)?",
    re.I,
)
_GITHUB_PROFILE_RE = re.compile(r"^https?://(?:www\.)?github\.com/[^/\s]+/?$", re.I)
_GITHUB_REPO_RE = re.compile(r"^https?://(?:www\.)?github\.com/[^/\s]+/.+", re.I)
_MALFORMED_HOST_RE = re.compile(r"(?i)(?:https?://)?(?:www\.)?(github|linkedin|leetcode)\1")


def normalize_resume_url(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip().rstrip(").,;]")
    if not text or text.lower() in _LINK_LABELS:
        return None
    if _MALFORMED_HOST_RE.search(text):
        text = _MALFORMED_HOST_RE.sub(r"https://\1", text)
    lower = text.lower()
    if lower.startswith("mailto:"):
        return text if "@" in text else None
    if lower.startswith("tel:"):
        return None
    if text.startswith(("http://", "https://")):
        return text
    if text.startswith("www."):
        return f"https://{text}"
    if "@" in text and "." in text.split("@", 1)[-1]:
        return f"mailto:{text}"
    if " " in text or "." not in text:
        return None
    return f"https://{text.lstrip('/')}"


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def _has_portfolio_signal(host: str, path: str) -> bool:
    blob = f"{host}{path}".lower()
    return any(signal in blob for signal in _PORTFOLIO_SIGNALS)


def _is_hosted_deploy(host: str) -> bool:
    return host.endswith(_HOSTED_DEPLOY_SUFFIXES) or host.endswith(".github.io")


def is_plausible_resume_url(value: Optional[str]) -> bool:
    normalized = normalize_resume_url(value)
    if not normalized:
        return False
    if normalized.lower().startswith("mailto:"):
        return True

    host = _host(normalized)
    if not host or host.startswith("xn--") or host in _LINK_LABELS or "." not in host:
        return False
    labels = host.split(".")
    if len(labels) < 2 or len(labels[-1]) < 2 or len(host) > 120:
        return False

    bare = host.removeprefix("www.")
    if bare in _BARE_PROVIDER_HOSTS:
        return False
    if bare.endswith(".edu") and not urlparse(normalized).path.strip("/"):
        return False
    if not urlparse(normalized).path.strip("/") and not _is_hosted_deploy(host):
        return False
    return True


def classify_resume_link(value: Optional[str]) -> LinkKind:
    normalized = normalize_resume_url(value)
    if not normalized or not is_plausible_resume_url(normalized):
        return "invalid"

    lower, host = normalized.lower(), _host(normalized)
    path = urlparse(normalized).path.lower()

    if lower.startswith("mailto:"):
        return "other"
    if "linkedin.com" in host:
        return "linkedin"
    if any(site in host for site in ("leetcode.com", "codeforces.com", "codechef.com", "codolio.com")):
        return "leetcode"
    if _GITHUB_REPO_RE.match(lower):
        return "github_repo"
    if _GITHUB_PROFILE_RE.match(lower):
        return "github_profile"
    if host.endswith(".github.io"):
        if _has_portfolio_signal(host, path) or not path.strip("/") or path.strip("/") == "index.html":
            return "portfolio"
        return "demo"
    if _is_hosted_deploy(host):
        # ponytail: deploy hosts default to project/demo links; portfolio only with explicit signal
        return "portfolio" if _has_portfolio_signal(host, path) else "demo"
    if _has_portfolio_signal(host, path):
        return "portfolio"
    if any(token in path for token in ("swagger-ui", "certificate", "certificates")) or host.endswith("pypi.org"):
        return "demo"
    return "other"


def is_contact_other_candidate(value: Optional[str]) -> bool:
    normalized = normalize_resume_url(value)
    if not normalized or not is_plausible_resume_url(normalized) or normalized.lower().startswith("mailto:"):
        return False
    kind = classify_resume_link(normalized)
    if kind in {"github_repo", "demo", "invalid", "github_profile", "linkedin", "portfolio"}:
        return False
    if kind == "leetcode":
        return True
    return any(hint in normalized.lower() for hint in _CONTACT_OTHER_HINTS)


def _canonical(value: str) -> str:
    return value.strip().lower().rstrip("/").replace("https://", "").replace("http://", "").replace("www.", "")


def unique_plausible_urls(values: Iterable[str]) -> List[str]:
    seen: set[str] = set()
    out: List[str] = []
    for value in values:
        url = normalize_resume_url(value)
        if not url or not is_plausible_resume_url(url):
            continue
        key = url.lower().rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        out.append(url)
    return out


def extract_urls_from_text(text: str) -> List[str]:
    return unique_plausible_urls(_URL_IN_TEXT_RE.findall(text or ""))


def _project_match_score(name: Optional[str], url: str) -> int:
    if not name:
        return 0
    tokens = [t for t in re.findall(r"[a-z0-9]+", name.lower()) if len(t) >= 3]
    blob = f"{urlparse(url).path} {_host(url)}".lower()
    return sum(len(t) for t in tokens if t in blob)


def _assign_project_links(profile: ResumeProfile, pool: List[str]) -> None:
    remaining = sorted(pool, key=lambda url: 0 if classify_resume_link(url) == "github_repo" else 1)
    for url in list(remaining):
        best_i, best_score = None, 0
        for i, project in enumerate(profile.projects):
            if project.link:
                continue
            score = _project_match_score(project.name, url)
            if score > best_score:
                best_i, best_score = i, score
        if best_i is not None and best_score > 0:
            profile.projects[best_i].link = url
            remaining.remove(url)
    for project in profile.projects:
        if not project.link and remaining:
            project.link = remaining.pop(0)


def reconcile_profile_links(
    profile: ResumeProfile,
    raw_text: str = "",
    pdf_links: Optional[Iterable[str]] = None,
) -> None:
    """Single pass: collect URLs, fill contact slots, assign project links, dedupe."""
    links = profile.contact.links
    candidates = unique_plausible_urls(
        [
            *(pdf_links or []),
            *extract_urls_from_text(raw_text),
            links.github,
            links.linkedin,
            links.portfolio,
            *(links.other or []),
            *(project.link for project in profile.projects if project.link),
        ]
    )

    links.github = links.linkedin = links.portfolio = None
    links.other = []
    project_pool: List[str] = []

    for url in candidates:
        kind = classify_resume_link(url)
        if kind in {"github_repo", "demo"}:
            project_pool.append(url)
        elif kind == "linkedin" and not links.linkedin:
            links.linkedin = url
        elif kind == "github_profile" and not links.github:
            links.github = url
        elif kind == "portfolio" and not links.portfolio and not _GITHUB_PROFILE_RE.match(url.lower()):
            links.portfolio = url
        elif is_contact_other_candidate(url):
            links.other.append(url)

    if links.portfolio and links.github and _canonical(links.portfolio) == _canonical(links.github):
        links.portfolio = None

    _assign_project_links(profile, project_pool)

    reserved = {_canonical(v) for v in (links.github, links.linkedin, links.portfolio) if v}
    reserved.update(_canonical(p.link) for p in profile.projects if p.link)
    links.other = [
        url
        for url in dict.fromkeys(links.other)
        if is_contact_other_candidate(url) and _canonical(url) not in reserved
    ]

    for project in profile.projects:
        if project.link:
            normalized = normalize_resume_url(project.link)
            project.link = normalized if normalized and is_plausible_resume_url(normalized) else None
