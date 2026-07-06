from __future__ import annotations

import asyncio
import secrets

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from config import get_settings
from services.resume_builder.compile_runner import (
    CompileError,
    CompileTimeoutError,
    compile_tex_to_pdf,
)
from utils.logger import get_logger

log = get_logger(__name__)
settings = get_settings()

app = FastAPI(title="Vetta Resume Builder Compile Service", version="1.0.0")


class CompileRequest(BaseModel):
    tex: str = Field(min_length=1, max_length=500_000)
    timeout_s: int | None = Field(default=None, ge=1, le=60)
    max_pdf_bytes: int | None = Field(default=None, ge=1_024, le=10_485_760)


def _verify_internal_token(token: str | None) -> None:
    expected = (settings.compile_service_token or "").strip()
    provided = (token or "").strip()
    if not expected or not secrets.compare_digest(expected, provided):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "tectonic_bin": settings.tectonic_bin,
        "token_configured": bool((settings.compile_service_token or "").strip()),
    }


@app.post("/internal/compile")
async def compile_resume(
    request: CompileRequest,
    x_internal_token: str | None = Header(default=None),
) -> Response:
    _verify_internal_token(x_internal_token)
    try:
        pdf_bytes, page_count = await asyncio.to_thread(
            compile_tex_to_pdf,
            request.tex,
            timeout_s=request.timeout_s,
            max_pdf_bytes=request.max_pdf_bytes,
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"X-Page-Count": str(page_count)},
        )
    except CompileTimeoutError:
        raise HTTPException(status_code=504, detail="compile_timeout") from None
    except CompileError as exc:
        log.warning("Resume compile failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        log.error("Unexpected compile failure", exc_info=exc)
        return JSONResponse(status_code=500, content={"detail": "compile_unavailable"})
