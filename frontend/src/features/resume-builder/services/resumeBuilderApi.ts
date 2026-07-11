import { auth } from 'firebaseConfig';

import type {
  CreateDraftPayload,
  DraftListResponse,
  DraftResponse,
  LatexResponse,
  PublishDraftPayload,
  PublishDraftResponse,
  ResumeBuilderHealthResponse,
  SaveDraftPayload,
  TemplateListResponse,
} from '../types/resumeBuilder';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type ErrorPayload = { detail?: unknown; message?: unknown } | null;

export class ResumeBuilderApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, options: { code?: string; status: number }) {
    super(message);
    this.name = 'ResumeBuilderApiError';
    this.code = options.code;
    this.status = options.status;
  }
}

const getErrorPayload = async (response: Response): Promise<ErrorPayload> => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json().catch(() => null)) as ErrorPayload;
  }
  return null;
};

const getErrorMessage = async (response: Response, fallback: string, payload?: ErrorPayload): Promise<string> => {
  const resolvedPayload = payload ?? (await getErrorPayload(response));
  if (typeof resolvedPayload?.detail === 'string' && resolvedPayload.detail.trim()) return resolvedPayload.detail.trim();
  if (
    resolvedPayload?.detail &&
    typeof resolvedPayload.detail === 'object' &&
    typeof (resolvedPayload.detail as { message?: unknown }).message === 'string' &&
    (resolvedPayload.detail as { message: string }).message.trim()
  ) {
    return (resolvedPayload.detail as { message: string }).message.trim();
  }
  if (typeof resolvedPayload?.message === 'string' && resolvedPayload.message.trim()) return resolvedPayload.message.trim();
  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
};

const parseJsonResponse = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) {
    const payload = await getErrorPayload(response);
    const message = await getErrorMessage(response, fallback, payload);
    const code =
      payload?.detail && typeof payload.detail === 'object' && typeof (payload.detail as { code?: unknown }).code === 'string'
        ? (payload.detail as { code: string }).code
        : undefined;
    throw new ResumeBuilderApiError(message, { code, status: response.status });
  }
  return response.json() as Promise<T>;
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

const getHealth = async (): Promise<ResumeBuilderHealthResponse> => {
  const response = await fetch(`${API_URL}/resume-builder/health`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<ResumeBuilderHealthResponse>(response, 'Failed to load builder health');
};

const listTemplates = async (): Promise<TemplateListResponse> => {
  const response = await fetch(`${API_URL}/resume-builder/templates`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<TemplateListResponse>(response, 'Failed to load templates');
};

const createDraft = async (payload: CreateDraftPayload): Promise<DraftResponse> => {
  const response = await fetch(`${API_URL}/resume-builder/drafts`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<DraftResponse>(response, 'Failed to create draft');
};

const listDrafts = async (): Promise<DraftListResponse> => {
  const response = await fetch(`${API_URL}/resume-builder/drafts`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<DraftListResponse>(response, 'Failed to load drafts');
};

const getDraft = async (draftId: string): Promise<DraftResponse> => {
  const response = await fetch(`${API_URL}/resume-builder/drafts/${encodeURIComponent(draftId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<DraftResponse>(response, 'Failed to load draft');
};

const saveDraft = async (draftId: string, payload: SaveDraftPayload): Promise<DraftResponse> => {
  const response = await fetch(`${API_URL}/resume-builder/drafts/${encodeURIComponent(draftId)}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<DraftResponse>(response, 'Failed to save draft');
};

const deleteDraft = async (draftId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/resume-builder/drafts/${encodeURIComponent(draftId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to delete draft'));
  }
};

const getLatex = async (draftId: string): Promise<LatexResponse> => {
  const response = await fetch(`${API_URL}/resume-builder/drafts/${encodeURIComponent(draftId)}/latex`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<LatexResponse>(response, 'Failed to load LaTeX');
};

const previewDraft = async (draftId: string): Promise<{ blob: Blob; pageCount: number }> => {
  const response = await fetch(`${API_URL}/resume-builder/drafts/${encodeURIComponent(draftId)}/preview`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to generate preview'));
  }
  const pageCount = Number(response.headers.get('X-Page-Count') || '0');
  return { blob: await response.blob(), pageCount: Number.isNaN(pageCount) ? 0 : pageCount };
};

const publishDraft = async (draftId: string, payload: PublishDraftPayload): Promise<PublishDraftResponse> => {
  const response = await fetch(`${API_URL}/resume-builder/drafts/${encodeURIComponent(draftId)}/publish`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<PublishDraftResponse>(response, 'Failed to publish draft');
};

const getTemplatePreview = async (templateId: string): Promise<Blob> => {
  const response = await fetch(`${API_URL}/resume-builder/templates/${encodeURIComponent(templateId)}/preview`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to load template preview'));
  }
  return response.blob();
};

export const resumeBuilderApi = {
  getHealth,
  listTemplates,
  getTemplatePreview,
  createDraft,
  listDrafts,
  getDraft,
  saveDraft,
  deleteDraft,
  getLatex,
  previewDraft,
  publishDraft,
};

