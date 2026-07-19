import { useSearchParams } from "react-router-dom";

import { useBackendHealth } from "shared/context/BackendHealthContext";

/** Resolve LiveKit vs WebSocket for the interview room route. */
export function useInterviewTransport(): boolean {
  const [searchParams] = useSearchParams();
  const { livekitAvailable, healthLoading } = useBackendHealth();
  const envForce = import.meta.env.VITE_USE_LIVEKIT;
  if (envForce === "true") return true;
  if (envForce === "false") return false;
  if (searchParams.get("transport") === "ws") return false;
  try {
    if (typeof window !== "undefined" && sessionStorage.getItem("force_ws")) return false;
  } catch {
    /* ignore */
  }
  return !healthLoading && livekitAvailable;
}
