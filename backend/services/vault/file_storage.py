"""Local disk storage for vault resume source files (PDF, DOCX, TXT)."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional, Tuple

from config import get_settings

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain; charset=utf-8",
}


def _storage_root() -> Path:
    settings = get_settings()
    root = Path(settings.vault_storage_dir)
    if not root.is_absolute():
        backend_root = Path(__file__).resolve().parents[2]
        root = backend_root / root
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_extension(filename: Optional[str]) -> str:
    if not filename:
        return ".bin"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return ".bin"
    return ext


def content_type_for_filename(filename: Optional[str]) -> str:
    ext = safe_extension(filename)
    return _CONTENT_TYPES.get(ext, "application/octet-stream")


def version_file_path(uid: str, resume_id: str, version_id: str, filename: Optional[str]) -> Path:
    ext = safe_extension(filename)
    return _storage_root() / uid / resume_id / f"{version_id}{ext}"


def save_version_file(
    uid: str,
    resume_id: str,
    version_id: str,
    filename: Optional[str],
    blob: bytes,
) -> Tuple[str, str]:
    if not blob:
        raise ValueError("empty_file")

    path = version_file_path(uid, resume_id, version_id, filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(blob)
    return path.name, content_type_for_filename(filename)


def read_version_file(uid: str, resume_id: str, version_id: str, filename: Optional[str]) -> bytes:
    path = version_file_path(uid, resume_id, version_id, filename)
    if not path.is_file():
        raise FileNotFoundError(str(path))
    return path.read_bytes()


def delete_version_file(uid: str, resume_id: str, version_id: str, filename: Optional[str]) -> None:
    path = version_file_path(uid, resume_id, version_id, filename)
    if path.is_file():
        path.unlink()
    parent = path.parent
    if parent.is_dir() and not any(parent.iterdir()):
        parent.rmdir()


def delete_resume_files(uid: str, resume_id: str) -> None:
    resume_dir = _storage_root() / uid / resume_id
    if resume_dir.is_dir():
        shutil.rmtree(resume_dir, ignore_errors=True)
    uid_dir = resume_dir.parent
    if uid_dir.is_dir() and not any(uid_dir.iterdir()):
        uid_dir.rmdir()
