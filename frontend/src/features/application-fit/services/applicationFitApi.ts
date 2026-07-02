import { auth } from 'firebaseConfig';

import type {
  ComputeRequest,
  ComputeResponse,
  HistoryResponse,
} from '../types/applicationFitTypes';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: unknown; message?: string };
    if (typeof payload.detail === 'string') return payload.detail;
    if (payload.detail && typeof payload.detail === 'object') {
      const obj = payload.detail as { message?: string; code?: string };
      if (obj.message) return obj.message;
    }
    if (payload.message) return payload.message;
  } catch {
    /* ignore */
  }
  return fallback;
};

export const applicationFitApi = {
  async compute(body: ComputeRequest): Promise<ComputeResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/jd-fit/compute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Failed to analyze application fit'));
    }
    return response.json() as Promise<ComputeResponse>;
  },

  async getHistory(targetRole: string, jobDescription = '', limit = 20): Promise<HistoryResponse> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      target_role: targetRole,
      limit: String(limit),
    });
    if (jobDescription.trim()) {
      params.set('job_description', jobDescription.trim());
    }
    const response = await fetch(`${API_URL}/jd-fit/history?${params}`, { headers });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Failed to load fit history'));
    }
    return response.json() as Promise<HistoryResponse>;
  },

  async getSnapshot(snapshotId: string): Promise<ComputeResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/jd-fit/snapshots/${snapshotId}`, { headers });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Snapshot not found'));
    }
    return response.json() as Promise<ComputeResponse>;
  },
};
