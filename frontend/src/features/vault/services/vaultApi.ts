import { auth } from 'firebaseConfig';

import type {
  ResumeProfile,
  UploadResumePayload,
  VaultAnalyzeResponse,
  VaultCompareResponse,
  VaultEntry,
  VaultListResponse,
  VaultRestoreResponse,
  VaultUpdatePayload,
  VaultUploadResponse,
  VaultVersion,
  VaultVersionsResponse,
} from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

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
  if (!response.ok) throw new Error('Failed to load vault');
  return response.json() as Promise<VaultListResponse>;
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
  if (!response.ok) throw new Error('Resume upload failed');
  return response.json() as Promise<VaultUploadResponse>;
};

const getEntry = async (resumeId: string): Promise<VaultEntry> => {
  const response = await fetch(`${API_URL}/vault/${encodeURIComponent(resumeId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to load entry');
  return response.json() as Promise<VaultEntry>;
};

const updateEntry = async (resumeId: string, payload: VaultUpdatePayload): Promise<VaultEntry> => {
  const response = await fetch(`${API_URL}/vault/${encodeURIComponent(resumeId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to update entry');
  return response.json() as Promise<VaultEntry>;
};

const deleteEntry = async (resumeId: string): Promise<{ status: string }> => {
  const response = await fetch(`${API_URL}/vault/${encodeURIComponent(resumeId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete entry');
  return response.json() as Promise<{ status: string }>;
};

const setActive = async (resumeId: string): Promise<{ status: string }> => {
  const response = await fetch(`${API_URL}/vault/${encodeURIComponent(resumeId)}/set-active`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to set active resume');
  return response.json() as Promise<{ status: string }>;
};

const listVersions = async (resumeId: string): Promise<VaultVersionsResponse> => {
  const response = await fetch(`${API_URL}/versions?resume_id=${encodeURIComponent(resumeId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to load versions');
  return response.json() as Promise<VaultVersionsResponse>;
};

const getVersion = async (versionId: string): Promise<VaultVersion> => {
  const response = await fetch(`${API_URL}/versions/${encodeURIComponent(versionId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to load version');
  return response.json() as Promise<VaultVersion>;
};

const restoreVersion = async (versionId: string, role?: string): Promise<VaultRestoreResponse> => {
  const response = await fetch(`${API_URL}/restore/${encodeURIComponent(versionId)}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error('Failed to restore version');
  return response.json() as Promise<VaultRestoreResponse>;
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
  if (!response.ok) throw new Error('Failed to analyze resume');
  return response.json() as Promise<VaultAnalyzeResponse>;
};

const compare = async (
  resumeAId: string,
  resumeBId: string,
  role?: string,
): Promise<VaultCompareResponse> => {
  const response = await fetch(`${API_URL}/compare`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ resume_a_id: resumeAId, resume_b_id: resumeBId, role }),
  });
  if (!response.ok) throw new Error('Failed to compare resumes');
  return response.json() as Promise<VaultCompareResponse>;
};

const getActiveResumeProfile = async (): Promise<ResumeProfile | null> => {
  const data = await listEntries();
  const entries = data.entries || [];
  const activeId = data.meta?.active_resume_id;
  const active = entries.find((entry) => entry.id === activeId) || entries.find((entry) => entry.is_active);
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
  restoreVersion,
  analyze,
  compare,
  getActiveResumeProfile,
};
