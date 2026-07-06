from __future__ import annotations

import io
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PyPDF2 import PdfReader

from config import get_settings


class CompileError(RuntimeError):
    pass


class CompileTimeoutError(TimeoutError):
    pass


def _compile_env() -> dict[str, str]:
    env = os.environ.copy()
    if sys.platform == "win32":
        fonts_conf = Path(__file__).resolve().parents[2] / "scripts" / "tectonic-fonts.conf"
        if fonts_conf.is_file():
            env["FONTCONFIG_FILE"] = str(fonts_conf)
            env["FONTCONFIG_PATH"] = str(fonts_conf.parent)
    return env


def compile_tex_to_pdf(tex: str, *, timeout_s: int | None = None, max_pdf_bytes: int | None = None) -> tuple[bytes, int]:
    settings = get_settings()
    timeout = timeout_s or settings.resume_builder_compile_timeout_s
    max_bytes = max_pdf_bytes or settings.resume_builder_max_pdf_bytes
    tectonic_bin = settings.tectonic_bin

    try:
        with tempfile.TemporaryDirectory(prefix="resume-builder-") as workdir:
            work_path = Path(workdir)
            tex_path = work_path / "resume.tex"
            tex_path.write_text(tex, encoding="utf-8")
            try:
                result = subprocess.run(
                    [tectonic_bin, "-X", "compile", str(tex_path), "--outdir", str(work_path)],
                    cwd=str(work_path),
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    env=_compile_env(),
                )
            except subprocess.TimeoutExpired as exc:
                raise CompileTimeoutError("compile_timeout") from exc
            if result.returncode != 0:
                raise CompileError(result.stderr.strip() or result.stdout.strip() or "compile_failed")

            pdf_path = work_path / "resume.pdf"
            if not pdf_path.exists():
                raise CompileError("compile_failed")
            pdf_bytes = pdf_path.read_bytes()
            if len(pdf_bytes) > max_bytes:
                raise CompileError("pdf_too_large")
            page_count = len(PdfReader(io.BytesIO(pdf_bytes)).pages)
            return pdf_bytes, page_count
    except (CompileError, CompileTimeoutError):
        raise
    except FileNotFoundError as exc:
        raise CompileError("tectonic_not_found") from exc

