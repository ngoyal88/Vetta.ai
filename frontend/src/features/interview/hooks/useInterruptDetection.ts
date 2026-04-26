import { useCallback, useRef } from "react";

type InterruptOptions = {
  energyThreshold: number;
  holdMs: number;
  debounceMs: number;
  minPlaybackMs: number;
};

export const useInterruptDetection = (options: InterruptOptions) => {
  const interruptCandidateSinceRef = useRef<number | null>(null);
  const lastInterruptAtRef = useRef(0);
  const aiPlaybackStartedAtRef = useRef(0);

  const markPlaybackStart = useCallback(() => {
    aiPlaybackStartedAtRef.current = Date.now();
  }, []);

  const clearPlaybackStart = useCallback(() => {
    aiPlaybackStartedAtRef.current = 0;
  }, []);

  const checkForInterrupt = useCallback(
    (level: number, isAiSpeaking: boolean, onInterrupt: () => void) => {
      if (!isAiSpeaking) {
        interruptCandidateSinceRef.current = null;
        return;
      }

      const now = Date.now();
      if (level >= options.energyThreshold) {
        if (!aiPlaybackStartedAtRef.current || now - aiPlaybackStartedAtRef.current < options.minPlaybackMs) {
          interruptCandidateSinceRef.current = null;
          return;
        }
        if (!interruptCandidateSinceRef.current) {
          interruptCandidateSinceRef.current = now;
        }
        if (
          now - (interruptCandidateSinceRef.current ?? now) >= options.holdMs &&
          now - lastInterruptAtRef.current >= options.debounceMs
        ) {
          lastInterruptAtRef.current = now;
          interruptCandidateSinceRef.current = null;
          onInterrupt();
        }
      } else {
        interruptCandidateSinceRef.current = null;
      }
    },
    [options.debounceMs, options.energyThreshold, options.holdMs, options.minPlaybackMs]
  );

  return {
    markPlaybackStart,
    clearPlaybackStart,
    checkForInterrupt,
  };
};
