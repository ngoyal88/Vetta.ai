import { auth } from 'firebaseConfig';

import type {
  ResumeProfile,
  UploadResumePayload,
  VaultAnalyzeResponse,
  VaultCompareResponse,
  VaultEntry,
  VaultListResponse,
  VaultRestoreResponse,
  VaultStatusResponse,
  VaultUpdatePayload,
  VaultUploadResponse,
  VaultVersion,
  VaultVersionsResponse,
} from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const formatValidationDetail = (detail: unknown): string | null => {
  if (!detail || typeof detail !== 'object') return null;

  const issue = detail as { msg?: unknown; loc?: unknown };
  const message = typeof issue.msg === 'string' ? issue.msg.trim() : '';
  if (!message) return null;

  if (!Array.isArray(issue.loc) || issue.loc.length === 0) {
    return message;
  }

  const location = issue.loc
    .filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
    .join('.');

  return location ? `${location}: ${message}` : message;
};

const getErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: unknown; message?: unknown }
      | null;

    if (typeof payload?.detail === 'string' && payload.detail.trim()) {
      return payload.detail.trim();
    }

    if (Array.isArray(payload?.detail)) {
      const combined = payload.detail
        .map((detail) => formatValidationDetail(detail))
        .filter((detail): detail is string => Boolean(detail))
        .join('; ');

      if (combined) return combined;
    }

    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
  }

  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
};

const parseJsonResponse = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallback));
  }

  return response.json() as Promise<T>;
};

const getAuthHeaders = async (isForm = false): Promise<Record<string, string>> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const base = { Authorization: `Bearer ${token}` };
  return isForm ? base : { 'Content-Type': 'application/json', ...base };
};

const listEntries = async (): Promise<VaultListResponse> => {
  const response = await fetch(`${API_URL}/vault`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<VaultListResponse>(response, 'Failed to load vault');
};

const uploadResume = async (payload: UploadResumePayload): Promise<VaultUploadResponse> => {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('name', payload.name);
  if (payload.tags) formData.append('tags', payload.tags);
  if (payload.resumeId) formData.append('resume_id', payload.resumeId);
  if (payload.userNote) formData.append('user_note', payload.userNote);
  if (payload.role) formData.append('role', payload.role);

  const response = await fetch(`${API_URL}/vault/upload`, {
    method: 'POST',
    headers: await getAuthHeaders(true),
    body: formData,
  });
  return parseJsonResponse<VaultUploadResponse>(response, 'Resume upload failed');
};

const getEntry = async (resumeId: string): Promise<VaultEntry> => {
  const response = await fetch(`${API_URL}/vault/${encodeURIComponent(resumeId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<VaultEntry>(response, 'Failed to load entry');
};

const updateEntry = async (resumeId: string, payload: VaultUpdatePayload): Promise<VaultEntry> => {
  const response = await fetch(`${API_URL}/vault/${encodeURIComponent(resumeId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<VaultEntry>(response, 'Failed to update entry');
};

const deleteEntry = async (resumeId: string): Promise<VaultStatusResponse> => {
  const response = await fetch(`${API_URL}/vault/${encodeURIComponent(resumeId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<VaultStatusResponse>(response, 'Failed to delete entry');
};

const setActive = async (resumeId: string): Promise<VaultStatusResponse> => {
  const response = await fetch(`${API_URL}/vault/${encodeURIComponent(resumeId)}/set-active`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<VaultStatusResponse>(response, 'Failed to set active resume');
};

const listVersions = async (resumeId: string): Promise<VaultVersionsResponse> => {
  const response = await fetch(`${API_URL}/versions?resume_id=${encodeURIComponent(resumeId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<VaultVersionsResponse>(response, 'Failed to load versions');
};

const getVersion = async (versionId: string): Promise<VaultVersion> => {
  const response = await fetch(`${API_URL}/versions/${encodeURIComponent(versionId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  return parseJsonResponse<VaultVersion>(response, 'Failed to load version');
};

const fetchVersionFile = async (versionId: string): Promise<Blob> => {
  const response = await fetch(`${API_URL}/vault/files/${encodeURIComponent(versionId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to load resume file'));
  }
  return response.blob();
};

const restoreVersion = async (versionId: string, role?: string): Promise<VaultRestoreResponse> => {
  const response = await fetch(`${API_URL}/restore/${encodeURIComponent(versionId)}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ role }),
  });
  return parseJsonResponse<VaultRestoreResponse>(response, 'Failed to restore version');
};

const analyze = async (
  resumeId: string,
  versionId?: string | null,
  role?: string,
): Promise<VaultAnalyzeResponse> => {
  const response = await fetch(`${API_URL}/analyze`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ resume_id: resumeId, version_id: versionId, role }),
  });
  return parseJsonResponse<VaultAnalyzeResponse>(response, 'Failed to analyze resume');
};

const compare = async (
  resumeAId: string,
  resumeBId: string,
  role?: string,
  versionAId?: string,
  versionBId?: string,
): Promise<VaultCompareResponse> => {
  const body: Record<string, string | undefined> = {
    resume_a_id: resumeAId,
    resume_b_id: resumeBId,
    role,
    version_a_id: versionAId,
    version_b_id: versionBId,
  };
  const response = await fetch(`${API_URL}/compare`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
  });
  return parseJsonResponse<VaultCompareResponse>(response, 'Failed to compare resumes');
};

const getActiveResumeProfile = async (): Promise<ResumeProfile | null> => {
  const data = await listEntries();
  const entries = data.entries || [];
  const activeId = data.meta?.active_resume_id;
  const active =
    entries.find((entry) => entry.id === activeId && entry.current_version_id) ||
    entries.find((entry) => entry.is_active && entry.current_version_id) ||
    entries.find((entry) => entry.current_version_id);

  if (!active || !active.current_version_id) return null;
  const version = await getVersion(active.current_version_id);
  return version?.profile_snapshot || null;
};

export const vaultApi = {
  listEntries,
  uploadResume,
  getEntry,
  updateEntry,
  deleteEntry,
  setActive,
  listVersions,
  getVersion,
  fetchVersionFile,
  restoreVersion,
  analyze,
  compare,
  getActiveResumeProfile,
};
