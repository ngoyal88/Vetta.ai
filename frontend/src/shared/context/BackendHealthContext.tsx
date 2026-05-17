import React, { createContext, useContext, useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type BackendHealthValue = {
  healthLoading: boolean;
  healthError: string | null;
  livekitAvailable: boolean;
  livekitUrl: string | null;
};

type BackendHealthProviderProps = {
  children: React.ReactNode;
};

type HealthResponse = {
  services?: {
    livekit?: boolean;
    agent?: boolean;
  };
  livekit_url?: string | null;
  detail?: string;
  message?: string;
};

const BackendHealthContext = createContext<BackendHealthValue | undefined>(undefined);

export const useBackendHealth = (): BackendHealthValue => {
  const value = useContext(BackendHealthContext);
  if (!value) throw new Error("useBackendHealth must be used within BackendHealthProvider");
  return value;
};

export const BackendHealthProvider = ({ children }: BackendHealthProviderProps) => {
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [livekitAvailable, setLivekitAvailable] = useState(false);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { method: "GET" });
        if (cancelled) return;

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as HealthResponse;
          const message = data?.detail || data?.message || `Health check failed (${res.status})`;
          setHealthError(message);
          setLivekitAvailable(false);
          setLivekitUrl(null);
          return;
        }

        const data = (await res.json().catch(() => ({}))) as HealthResponse;
        setHealthError(null);
        setLivekitAvailable(Boolean(data?.services?.livekit && data?.services?.agent));
        setLivekitUrl(data?.livekit_url ?? null);
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Health check failed";
          setHealthError(message);
          setLivekitAvailable(false);
          setLivekitUrl(null);
        }
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BackendHealthContext.Provider value={{ healthLoading, healthError, livekitAvailable, livekitUrl }}>
      {children}
    </BackendHealthContext.Provider>
  );
};
