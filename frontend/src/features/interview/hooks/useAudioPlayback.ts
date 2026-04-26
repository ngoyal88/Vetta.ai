import { useCallback, useEffect, useRef } from "react";
import { AudioPlayer } from "shared/utils/audioUtils";

type PlaybackOptions = {
  setAiSpeakingState: (value: boolean) => void;
  setAiText: (value: string) => void;
  setAiFullText: (value: string) => void;
  setAiSpeechWpm: (value: number) => void;
  setStatus: (value: string) => void;
  sendControl: (message: unknown) => void;
  scheduleMicResume: (delayMs?: number) => void;
  onPlaybackEnd?: () => void;
  onLocalPlaybackStart?: () => void;
};

export const useAudioPlayback = (options: PlaybackOptions) => {
  const playerRef = useRef<AudioPlayer | null>(null);
  const aiTextFullRef = useRef<string>("");
  const aiRevealTimerRef = useRef<number | null>(null);
  const activeTtsStreamIdRef = useRef<string | null>(null);

  const clearAiReveal = useCallback(() => {
    if (aiRevealTimerRef.current) {
      window.clearInterval(aiRevealTimerRef.current);
      aiRevealTimerRef.current = null;
    }
  }, []);

  const stopAiPlaybackLocally = useCallback(
    (messageType: string | null) => {
      try {
        playerRef.current?.stop();
      } catch (_) {}
      options.setAiSpeakingState(false);
      options.setStatus("listening");
      clearAiReveal();
      activeTtsStreamIdRef.current = null;
      if (messageType) {
        options.sendControl({ type: messageType });
      }
      options.onPlaybackEnd?.();
      options.scheduleMicResume();
    },
    [clearAiReveal, options]
  );

  const playInterviewTtsBase64 = useCallback(
    (base64Audio: string | null) => {
      if (!base64Audio || !playerRef.current) {
        if (aiTextFullRef.current) options.setAiText(aiTextFullRef.current);
        return;
      }
      options.setAiSpeakingState(true);
      options.setAiText("");
      options.onLocalPlaybackStart?.();

      playerRef.current.play(base64Audio, {
        onStart: ({ durationSeconds }: { durationSeconds?: number } = {}) => {
          options.setAiSpeakingState(true);
          const text = (aiTextFullRef.current || "").trim();
          if (!text) return;
          const words = text.split(/\s+/).filter(Boolean);
          if (words.length <= 1) {
            options.setAiText(text);
            return;
          }
          const durSec =
            Number.isFinite(durationSeconds) && durationSeconds > 0
              ? durationSeconds
              : Math.max(1.0, words.length / 2.5);
          const durationMs = durSec * 1000;
          if (durSec) {
            const wpm = Math.max(80, Math.min(260, Math.round((words.length * 60) / durSec)));
            options.setAiSpeechWpm(wpm);
          }
          const start = performance.now();
          options.setAiText(words[0]);
          aiRevealTimerRef.current = window.setInterval(() => {
            const elapsed = performance.now() - start;
            const frac = Math.max(0, Math.min(1, elapsed / durationMs));
            const targetCount = Math.max(1, Math.ceil(frac * words.length));
            options.setAiText(words.slice(0, targetCount).join(" "));
            if (frac >= 1) {
              clearAiReveal();
            }
          }, 50);
        },
        onEnd: () => {
          options.setAiSpeakingState(false);
          options.onPlaybackEnd?.();
          try {
            options.sendControl({ type: "ai_playback_ended" });
          } catch (_) {}
          clearAiReveal();
          if (aiTextFullRef.current) options.setAiText(aiTextFullRef.current);
          options.scheduleMicResume(0);
        },
      });
    },
    [clearAiReveal, options]
  );

  useEffect(() => {
    playerRef.current = new AudioPlayer();
    return () => {
      try {
        playerRef.current?.stop();
      } catch (_) {}
      playerRef.current = null;
    };
  }, []);

  return {
    playerRef,
    aiTextFullRef,
    activeTtsStreamIdRef,
    clearAiReveal,
    playInterviewTtsBase64,
    stopAiPlaybackLocally,
    setAiTextFull: (text: string) => {
      aiTextFullRef.current = text;
      options.setAiFullText(text);
    },
  };
};
