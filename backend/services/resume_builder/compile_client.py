from __future__ import annotations

import httpx

from config import get_settings


class CompileServiceUnavailableError(RuntimeError):
    pass


class CompileRequestError(ValueError):
    pass


async def compile_preview(tex: str) -> tuple[bytes, int]:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=settings.resume_builder_compile_timeout_s + 5) as client:
            response = await client.post(
                f"{settings.compile_service_url.rstrip('/')}/internal/compile",
                headers={"X-Internal-Token": settings.compile_service_token},
                json={
                    "tex": tex,
                    "timeout_s": settings.resume_builder_compile_timeout_s,
                    "max_pdf_bytes": settings.resume_builder_max_pdf_bytes,
                },
            )
    except Exception as exc:
        raise CompileServiceUnavailableError("compile_unavailable") from exc

    if response.status_code == 401:
        raise CompileServiceUnavailableError("compile_unauthorized")
    if response.status_code >= 500:
        raise CompileServiceUnavailableError("compile_unavailable")
    if response.status_code >= 400:
        detail = ""
        try:
            payload = response.json()
            detail = str(payload.get("detail") or "").strip()
        except Exception:
            detail = response.text.strip()
        raise CompileRequestError(detail or "compile_failed")

    try:
        page_count = int(response.headers.get("X-Page-Count") or "0")
    except ValueError:
        page_count = 0
    return response.content, page_count


async def compile_service_health() -> bool:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.compile_service_url.rstrip('/')}/health")
        return response.status_code == 200
    except Exception:
        return False
