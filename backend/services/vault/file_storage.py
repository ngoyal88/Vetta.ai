"""Vault resume file storage: Supabase Storage when configured, else local disk."""

from __future__ import annotations

import shutil
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal, Optional, Tuple

from config import get_settings

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain; charset=utf-8",
}

StorageBackend = Literal["supabase", "local"]


def is_supabase_enabled() -> bool:
    settings = get_settings()
    return bool(
        settings.supabase_url
        and settings.supabase_service_role_key
        and settings.supabase_vault_bucket
    )


def active_storage_backend() -> StorageBackend:
    return "supabase" if is_supabase_enabled() else "local"


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


def version_file_path(uid: str, resume_id: str, version_id: str, filename: Optional[str]) -> str:
    ext = safe_extension(filename)
    return f"users/{uid}/resumes/{resume_id}/{version_id}{ext}"


def _resolve_storage_path(
    uid: str,
    resume_id: str,
    version_id: str,
    filename: Optional[str],
    storage_path: Optional[str],
) -> str:
    if storage_path and storage_path.strip():
        return storage_path.strip()
    return version_file_path(uid, resume_id, version_id, filename)


def _local_root() -> Path:
    settings = get_settings()
    root = Path(settings.vault_storage_dir)
    if not root.is_absolute():
        backend_root = Path(__file__).resolve().parents[2]
        root = backend_root / root
    return root


def _local_file_path(storage_path: str) -> Path:
    return _local_root() / Path(storage_path)


def _resume_prefix(uid: str, resume_id: str) -> str:
    return f"users/{uid}/resumes/{resume_id}"


def _is_not_found_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None) or getattr(exc, "status", None)
    if status_code == 404:
        return True

    message = str(exc).lower()
    return "not found" in message or "does not exist" in message


def _object_names(items: Any) -> list[str]:
    if not isinstance(items, list):
        return []

    names: list[str] = []
    for item in items:
        name = item.get("name") if isinstance(item, dict) else getattr(item, "name", None)
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    return names


@lru_cache(maxsize=1)
def _supabase_client():
    from supabase import create_client

    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def _supabase_bucket():
    settings = get_settings()
    return _supabase_client().storage.from_(settings.supabase_vault_bucket)


def _save_supabase(path: str, blob: bytes, content_type: str) -> None:
    _supabase_bucket().upload(
        path=path,
        file=blob,
        file_options={
            "content-type": content_type,
            "upsert": "false",
        },
    )


def _read_supabase(path: str) -> bytes:
    try:
        payload = _supabase_bucket().download(path)
    except Exception as exc:
        if _is_not_found_error(exc):
            raise FileNotFoundError(path) from exc
        raise

    if isinstance(payload, bytes):
        return payload
    if isinstance(payload, bytearray):
        return bytes(payload)
    if hasattr(payload, "content") and isinstance(payload.content, bytes):
        return payload.content

    return bytes(payload)


def _delete_supabase(path: str) -> None:
    try:
        _supabase_bucket().remove([path])
    except Exception as exc:
        if not _is_not_found_error(exc):
            raise


def _delete_supabase_prefix(prefix: str) -> None:
    try:
        items = _supabase_bucket().list(prefix)
    except Exception as exc:
        if _is_not_found_error(exc):
            return
        raise

    paths = [f"{prefix}/{name}" for name in _object_names(items)]
    if not paths:
        return

    try:
        _supabase_bucket().remove(paths)
    except Exception as exc:
        if not _is_not_found_error(exc):
            raise


def _save_local(path: str, blob: bytes) -> None:
    target = _local_file_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(blob)


def _read_local(path: str) -> bytes:
    target = _local_file_path(path)
    if not target.is_file():
        raise FileNotFoundError(path)
    return target.read_bytes()


def _delete_local(path: str) -> None:
    target = _local_file_path(path)
    if target.is_file():
        target.unlink()


def _delete_local_resume(uid: str, resume_id: str) -> None:
    resume_dir = _local_root() / Path(_resume_prefix(uid, resume_id))
    if resume_dir.is_dir():
        shutil.rmtree(resume_dir, ignore_errors=True)


def save_version_file(
    uid: str,
    resume_id: str,
    version_id: str,
    filename: Optional[str],
    blob: bytes,
) -> Tuple[str, str, StorageBackend]:
    if not blob:
        raise ValueError("empty_file")

    path = version_file_path(uid, resume_id, version_id, filename)
    content_type = content_type_for_filename(filename)
    backend = active_storage_backend()

    if backend == "supabase":
        _save_supabase(path, blob, content_type)
    else:
        _save_local(path, blob)

    return path, content_type, backend


def read_version_file(
    uid: str,
    resume_id: str,
    version_id: str,
    filename: Optional[str],
    *,
    storage_path: Optional[str] = None,
    storage_backend: Optional[StorageBackend] = None,
) -> bytes:
    path = _resolve_storage_path(uid, resume_id, version_id, filename, storage_path)
    backend = storage_backend or active_storage_backend()

    if backend == "supabase":
        return _read_supabase(path)
    return _read_local(path)


def delete_version_file(
    uid: str,
    resume_id: str,
    version_id: str,
    filename: Optional[str],
    *,
    storage_path: Optional[str] = None,
    storage_backend: Optional[StorageBackend] = None,
) -> None:
    path = _resolve_storage_path(uid, resume_id, version_id, filename, storage_path)
    backend = storage_backend or active_storage_backend()

    if backend == "supabase":
        _delete_supabase(path)
    else:
        _delete_local(path)


def delete_resume_files(uid: str, resume_id: str) -> None:
    prefix = _resume_prefix(uid, resume_id)
    if is_supabase_enabled():
        _delete_supabase_prefix(prefix)
    _delete_local_resume(uid, resume_id)
