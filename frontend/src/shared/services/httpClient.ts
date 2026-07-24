import { auth } from "firebaseConfig";
import { getE2EAuthHeaders } from "shared/e2e/e2eMockAuth";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type AuthHeaders = Record<string, string>;

export async function getAuthHeaders(isForm = false): Promise<AuthHeaders> {
  const e2eHeaders = await getE2EAuthHeaders(isForm);
  if (e2eHeaders) return e2eHeaders;
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  const base: AuthHeaders = { Authorization: `Bearer ${token}` };
  return isForm ? base : { "Content-Type": "application/json", ...base };
}

export async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string; message?: string };
    if (typeof body?.detail === "string") return body.detail;
    if (typeof body?.message === "string") return body.message;
  } catch {
    /* ignore */
  }
  return fallback;
}

export type AuthenticatedFetchOptions = RequestInit & {
  isForm?: boolean;
  authToken?: string | null;
};

export async function authenticatedFetch(
  path: string,
  options: AuthenticatedFetchOptions = {},
): Promise<Response> {
  const { isForm = false, authToken, ...init } = options;
  const headers =
    authToken != null
      ? ({ Authorization: `Bearer ${authToken}` } as AuthHeaders)
      : await getAuthHeaders(isForm);
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });
}

export async function authenticatedJson<T>(
  path: string,
  options: AuthenticatedFetchOptions = {},
  fallbackError: string,
): Promise<T> {
  const response = await authenticatedFetch(path, options);
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, fallbackError));
  }
  return response.json() as Promise<T>;
}

export async function getFreshAuthHeaders(): Promise<AuthHeaders> {
  const e2eHeaders = await getE2EAuthHeaders();
  if (e2eHeaders) return e2eHeaders;
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken(true);
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}
