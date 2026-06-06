import React, { createContext, useContext, useEffect, useState } from "react";

import { api, type BackendHealthResponse } from "shared/services/api";

type BackendHealthValue = {
  healthLoading: boolean;
  healthError: string | null;
  livekitAvailable: boolean;
  livekitUrl: string | null;
};

type BackendHealthProviderProps = {
  children: React.ReactNode;
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
        const data = (await api.getBackendHealth()) as BackendHealthResponse;
        if (cancelled) return;

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
