from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse

from config import get_settings
from services.resume_builder.compile_client import (
    CompileRequestError,
    CompileServiceUnavailableError,
    compile_preview,
    compile_service_health,
)
from services.resume_builder.draft_store import create_draft, delete_draft, get_draft, list_drafts, patch_draft, save_draft
from services.resume_builder.models import (
    BuilderValidationError,
    CreateDraftRequest,
    DraftListResponse,
    DraftPatchRequest,
    DraftResponse,
    DraftUpdateRequest,
    HealthResponse,
    LatexResponse,
    PublishDraftRequest,
    PublishDraftResponse,
    TemplateListResponse,
    validate_draft_name,
    validate_identity_fields,
)
from services.resume_builder.publish_service import publish_draft
from services.resume_builder.template_catalog import get_template, list_templates, template_preview_file
from services.resume_builder.template_renderer import render_template
from services.vault.vault_service import get_vault_entry, get_version_by_id
from utils.auth import verify_firebase_token
from utils.http_errors import raise_internal_error, raise_service_error
from utils.logger import get_logger
from utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/resume-builder", tags=["ResumeBuilder"])
log = get_logger(__name__)


def _ensure_enabled() -> None:
    if not get_settings().resume_builder_enabled:
        raise HTTPException(status_code=404, detail="Resume Builder is disabled")


async def _load_source_profile(uid: str, request: CreateDraftRequest) -> dict | None:
    if request.version_id:
        version = await get_version_by_id(uid, request.version_id)
        if not version:
            raise HTTPException(status_code=404, detail="Source version not found")
        return version.get("profile_snapshot") or {}
    if request.resume_id:
        entry = await get_vault_entry(uid, request.resume_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Source resume not found")
        current_version_id = entry.get("current_version_id")
        if not current_version_id:
            raise HTTPException(status_code=404, detail="Source resume has no version")
        version = await get_version_by_id(uid, current_version_id)
        if not version:
            raise HTTPException(status_code=404, detail="Source version not found")
        return version.get("profile_snapshot") or {}
    return None


@router.get("/health", response_model=HealthResponse)
async def resume_builder_health(uid: str = Depends(verify_firebase_token)) -> HealthResponse:
    del uid
    enabled = get_settings().resume_builder_enabled
    compile_ok = enabled and await compile_service_health()
    return HealthResponse(enabled=enabled, compile_ok=compile_ok)


@router.get("/templates", response_model=TemplateListResponse)
async def resume_builder_templates(uid: str = Depends(verify_firebase_token)) -> TemplateListResponse:
    del uid
    _ensure_enabled()
    return TemplateListResponse(templates=list_templates())


@router.get("/templates/{template_id}/preview")
async def resume_builder_template_preview(
    template_id: str,
    uid: str = Depends(verify_firebase_token),
) -> FileResponse:
    del uid
    _ensure_enabled()
    preview_path = template_preview_file(template_id)
    if preview_path is None:
        raise HTTPException(status_code=404, detail="Template preview not found")
    suffix = preview_path.suffix.lower()
    media_types = {
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }
    media_type = media_types.get(suffix)
    return FileResponse(preview_path, media_type=media_type, filename=preview_path.name)


@router.post("/drafts", response_model=DraftResponse)
async def resume_builder_create_draft(
    request: CreateDraftRequest,
    uid: str = Depends(verify_firebase_token),
) -> DraftResponse:
    _ensure_enabled()
    await check_rate_limit(uid, "resume_builder_draft_save", limit=60, window_seconds=60)
    try:
        get_template(request.template_id)
        source_profile = await _load_source_profile(uid, request)
        if source_profile is None:
            if request.profile is None:
                raise HTTPException(status_code=422, detail="Name and email are required to create a new draft")
            validate_identity_fields(request.profile)
        draft = await create_draft(uid, request, source_profile=source_profile)
        return DraftResponse(draft=draft)
    except HTTPException:
        raise
    except BuilderValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.as_detail()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise_internal_error(log, exc, message="Failed to create builder draft")


@router.get("/drafts", response_model=DraftListResponse)
async def resume_builder_list_drafts(uid: str = Depends(verify_firebase_token)) -> DraftListResponse:
    _ensure_enabled()
    drafts = await list_drafts(uid)
    return DraftListResponse(drafts=drafts)


@router.get("/drafts/{draft_id}", response_model=DraftResponse)
async def resume_builder_get_draft(draft_id: str, uid: str = Depends(verify_firebase_token)) -> DraftResponse:
    _ensure_enabled()
    draft = await get_draft(uid, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return DraftResponse(draft=draft)


@router.put("/drafts/{draft_id}", response_model=DraftResponse)
async def resume_builder_save_draft(
    draft_id: str,
    request: DraftUpdateRequest,
    uid: str = Depends(verify_firebase_token),
) -> DraftResponse:
    _ensure_enabled()
    await check_rate_limit(uid, "resume_builder_draft_save", limit=60, window_seconds=60)
    try:
        validate_identity_fields(request.profile)
        draft_name = validate_draft_name(request.name)
        draft = await save_draft(
            uid,
            draft_id,
            request.model_copy(update={"name": draft_name}),
        )
        return DraftResponse(draft=draft)
    except BuilderValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.as_detail()) from exc
    except ValueError as exc:
        if str(exc) == "draft_not_found":
            raise HTTPException(status_code=404, detail="Draft not found") from exc
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise_internal_error(log, exc, message="Failed to save builder draft")


@router.patch("/drafts/{draft_id}", response_model=DraftResponse)
async def resume_builder_patch_draft(
    draft_id: str,
    request: DraftPatchRequest,
    uid: str = Depends(verify_firebase_token),
) -> DraftResponse:
    _ensure_enabled()
    await check_rate_limit(uid, "resume_builder_draft_save", limit=60, window_seconds=60)
    try:
        if request.profile is not None:
            validate_identity_fields(request.profile)
        draft = await patch_draft(uid, draft_id, request)
        return DraftResponse(draft=draft)
    except BuilderValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.as_detail()) from exc
    except ValueError as exc:
        if str(exc) == "draft_not_found":
            raise HTTPException(status_code=404, detail="Draft not found") from exc
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise_internal_error(log, exc, message="Failed to update builder draft")


@router.delete("/drafts/{draft_id}", status_code=204)
async def resume_builder_delete_draft(draft_id: str, uid: str = Depends(verify_firebase_token)) -> Response:
    _ensure_enabled()
    await check_rate_limit(uid, "resume_builder_draft_save", limit=60, window_seconds=60)
    deleted = await delete_draft(uid, draft_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Draft not found")
    return Response(status_code=204)


@router.get("/drafts/{draft_id}/latex", response_model=LatexResponse)
async def resume_builder_get_latex(draft_id: str, uid: str = Depends(verify_firebase_token)) -> LatexResponse:
    _ensure_enabled()
    draft = await get_draft(uid, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    try:
        tex = render_template(draft.template_id, draft)
        return LatexResponse(tex=tex)
    except BuilderValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.as_detail()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise_internal_error(log, exc, message="Failed to render LaTeX")


@router.post("/drafts/{draft_id}/preview")
async def resume_builder_preview(draft_id: str, uid: str = Depends(verify_firebase_token)) -> Response:
    _ensure_enabled()
    await check_rate_limit(uid, "resume_builder_preview", limit=30, window_seconds=60)
    draft = await get_draft(uid, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    try:
        validate_identity_fields(draft.profile)
        tex = render_template(draft.template_id, draft)
        pdf_bytes, page_count = await compile_preview(tex)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"X-Page-Count": str(page_count)},
        )
    except BuilderValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.as_detail()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CompileRequestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CompileServiceUnavailableError as exc:
        raise_service_error(
            log,
            exc,
            message="Preview service is temporarily unavailable",
            log_event="Resume builder compile service unavailable",
            default_status=503,
        )
    except Exception as exc:
        raise_internal_error(log, exc, message="Failed to generate preview")


@router.post("/drafts/{draft_id}/publish", response_model=PublishDraftResponse)
async def resume_builder_publish(
    draft_id: str,
    request: PublishDraftRequest,
    uid: str = Depends(verify_firebase_token),
) -> PublishDraftResponse:
    _ensure_enabled()
    await check_rate_limit(uid, "resume_builder_publish", limit=10, window_seconds=60)
    try:
        return await publish_draft(uid, draft_id, request)
    except BuilderValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.as_detail()) from exc
    except ValueError as exc:
        message = str(exc)
        if message == "draft_not_found":
            raise HTTPException(status_code=404, detail="Draft not found") from exc
        if message == "resume_not_found":
            raise HTTPException(status_code=404, detail="Resume entry not found") from exc
        if message == "version_limit_reached":
            raise HTTPException(status_code=403, detail="Version limit reached (max 5).") from exc
        if message == "resume_limit_reached":
            raise HTTPException(status_code=403, detail="Resume limit reached (max 5).") from exc
        if message == "invalid_name":
            raise HTTPException(status_code=400, detail="Resume name cannot be blank.") from exc
        raise HTTPException(status_code=422, detail=message) from exc
    except CompileRequestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CompileServiceUnavailableError as exc:
        raise_service_error(
            log,
            exc,
            message="Publish service is temporarily unavailable",
            log_event="Resume builder publish compile service unavailable",
            default_status=503,
        )
    except Exception as exc:
        raise_internal_error(log, exc, message="Failed to publish draft")

