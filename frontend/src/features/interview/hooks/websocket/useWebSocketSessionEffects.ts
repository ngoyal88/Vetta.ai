import { useEffect } from "react";
import { checkBrowserSupport } from "shared/utils/audioUtils";
import toast from "react-hot-toast";
import type { UseWebSocketSessionEffectsOptions } from "../../types";

export const useWebSocketSessionEffects = (options: UseWebSocketSessionEffectsOptions) => {
  const { sessionId, isRecording, micEnabled, connect, disconnect, recorderRef, setError } = options;

  useEffect(() => {
    const support = checkBrowserSupport();
    if (!support.supported) {
      const missing = Object.entries(support.features)
        .filter(([, supported]) => !supported)
        .map(([feature]) => feature);
      setError(`Browser not supported. Missing: ${missing.join(", ")}`);
      toast.error("Browser not supported for voice interviews");
    }
  }, [setError]);

  useEffect(() => {
    if (!sessionId) return;
    void connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect, sessionId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording) {
        recorderRef.current?.pause();
      } else if (!document.hidden && isRecording && micEnabled) {
        recorderRef.current?.resume();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isRecording, micEnabled, recorderRef]);
};
