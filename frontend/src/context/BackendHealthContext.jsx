import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const BackendHealthContext = createContext({
  healthLoading: true,
  healthError: null,
  livekitAvailable: false,
  livekitUrl: null,
});

export const useBackendHealth = () => useContext(BackendHealthContext);

export const BackendHealthProvider = ({ children }) => {
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);
  const [livekitAvailable, setLivekitAvailable] = useState(false);
  const [livekitUrl, setLivekitUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { method: 'GET' });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        setHealthError(null);
        setLivekitAvailable(Boolean(data?.services?.livekit));
        setLivekitUrl(data?.livekit_url ?? null);
      } catch (e) {
        if (!cancelled) {
          setHealthError(e?.message || 'Health check failed');
          setLivekitAvailable(false);
          setLivekitUrl(null);
        }
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <BackendHealthContext.Provider
      value={{ healthLoading, healthError, livekitAvailable, livekitUrl }}
    >
      {children}
    </BackendHealthContext.Provider>
  );
};
