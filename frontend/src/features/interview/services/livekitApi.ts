import { API_URL, authenticatedFetch, authenticatedJson } from "shared/services/httpClient";

export type BackendHealthResponse = {
  services?: {
    livekit?: boolean;
    agent?: boolean;
    [key: string]: unknown;
  };
  livekit_url?: string | null;
  detail?: string;
  message?: string;
  [key: string]: unknown;
};

export type LivekitTokenResponse = {
  token: string;
  url: string;
  room_name?: string;
};

export type LivekitHealthResponse = {
  ok?: boolean;
  detail?: string;
  [key: string]: unknown;
};

export async function getBackendHealth(signal?: AbortSignal): Promise<BackendHealthResponse> {
  const response = await fetch(`${API_URL}/health`, { method: "GET", signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as BackendHealthResponse;
    throw new Error(body?.detail || body?.message || `Health check failed (${response.status})`);
  }
  return response.json() as Promise<BackendHealthResponse>;
}

const getLivekitHealth = async (
  authToken?: string | null,
  signal?: AbortSignal,
): Promise<LivekitHealthResponse> => {
  const response = await authenticatedFetch("/livekit/health", {
    method: "GET",
    authToken: authToken ?? undefined,
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<LivekitHealthResponse>;
};

const createLivekitToken = async (
  sessionId: string,
  options: { dispatchAgent?: boolean } = {},
): Promise<LivekitTokenResponse> =>
  authenticatedJson(
    "/livekit/token",
    {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        dispatch_agent: Boolean(options.dispatchAgent),
      }),
    },
    "Failed to get LiveKit token",
  );

const attachLivekitAgent = async (sessionId: string): Promise<Record<string, unknown>> =>
  authenticatedJson(
    "/livekit/attach",
    {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    },
    "Failed to dispatch LiveKit interview agent",
  );

export const livekitApi = {
  getBackendHealth,
  getLivekitHealth,
  createLivekitToken,
  attachLivekitAgent,
};
