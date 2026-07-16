import { auth } from 'firebaseConfig';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
};

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: unknown; message?: string };
    if (typeof payload.detail === 'string') return payload.detail;
    if (payload.detail && typeof payload.detail === 'object') {
      const obj = payload.detail as { message?: string };
      if (obj.message) return obj.message;
    }
    if (payload.message) return payload.message;
  } catch {
    /* ignore */
  }
  return fallback;
};

export const jdTextApi = {
  async extractJdTextFromFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/jd-fit/extract-text`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Could not extract text from file'));
    }
    const payload = (await response.json()) as { text?: string };
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      throw new Error('Could not extract text from file');
    }
    return text;
  },
};
