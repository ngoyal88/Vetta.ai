import { auth } from 'firebaseConfig';

import type { ContactIntent } from '../components/ContactIntentPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 25_000;
const AUTH_TOKEN_TIMEOUT_MS = 5_000;

export type ContactRequestPayload = {
  intent: ContactIntent;
  firstName: string;
  lastName: string;
  email: string;
  userMessage: string;
  sourcePage?: string;
};

export type ContactSubmitResult = {
  ok: boolean;
  stored: boolean;
  email_sent: boolean;
  notified: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = auth.currentUser;
  if (user && !user.isAnonymous) {
    try {
      const token = await withTimeout(user.getIdToken(), AUTH_TOKEN_TIMEOUT_MS, 'Auth');
      headers.Authorization = `Bearer ${token}`;
    } catch {
      /* Proceed without auth — contact endpoint is public */
    }
  }
  return headers;
}

function fetchErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('timed out')) {
      return 'Request timed out. Is the API server running?';
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Cannot reach the server. Check that the backend is running and VITE_API_URL is correct.';
    }
    return error.message;
  }
  return 'Could not submit your message';
}

export async function submitContactRequest(payload: ContactRequestPayload): Promise<ContactSubmitResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}/contact`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        intent: payload.intent,
        first_name: payload.firstName,
        last_name: payload.lastName,
        email: payload.email,
        user_message: payload.userMessage,
        source_page: payload.sourcePage ?? 'contact',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = 'Could not submit your message';
      try {
        const data = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
        if (typeof data.detail === 'string') {
          detail = data.detail;
        } else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
          detail = data.detail.map((item) => item.msg).filter(Boolean).join(', ');
        }
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }

    return response.json() as Promise<ContactSubmitResult>;
  } catch (error) {
    throw new Error(fetchErrorMessage(error));
  } finally {
    clearTimeout(timeoutId);
  }
}
