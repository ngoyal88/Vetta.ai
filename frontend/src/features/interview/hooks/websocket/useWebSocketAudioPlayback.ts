import { useCallback, useEffect, useRef } from "react";
import { AudioPlayer } from "shared/utils/audioUtils";
import type { UseWebSocketAudioPlaybackOptions } from "../../types";

export const useWebSocketAudioPlayback = (options: UseWebSocketAudioPlaybackOptions) => {
  const playerRef = useRef<AudioPlayer | null>(null);
  const aiTextFullRef = useRef("");
  const aiRevealTimerRef = useRef<number | null>(null);

  const clearReveal = useCallback(() => {
    if (aiRevealTimerRef.current != null) {
      window.clearInterval(aiRevealTimerRef.current);
      aiRevealTimerRef.current = null;
    }
  }, []);

  const setAiTextFull = useCallback(
    (text: string) => {
      const next = text || "";
      aiTextFullRef.current = next;
      options.setAiFullText(next);
    },
    [options]
  );

  const stopPlayback = useCallback(() => {
    try {
      playerRef.current?.stop();
    } catch {}
    options.setAiSpeaking(false);
    clearReveal();
    if (aiTextFullRef.current) {
      options.setAiText(aiTextFullRef.current);
    }
    options.onPlaybackEnd?.();
  }, [clearReveal, options]);

  const playQuestionAudio = useCallback(
    (base64Audio: string | null) => {
      if (!base64Audio || !playerRef.current) {
        if (aiTextFullRef.current) options.setAiText(aiTextFullRef.current);
        options.setAiSpeechWpm(180);
        return;
      }
      options.setAiSpeaking(true);
      options.onPlaybackStart?.();
      options.setAiText("");

      playerRef.current.play(base64Audio, {
        onStart: ({ durationSeconds }: { durationSeconds?: number } = {}) => {
          options.setAiSpeaking(true);
          const text = aiTextFullRef.current.trim();
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
          const wpm = Math.max(80, Math.min(260, Math.round((words.length * 60) / durSec)));
          options.setAiSpeechWpm(wpm);
          const start = performance.now();
          options.setAiText(words[0]);
          clearReveal();
          aiRevealTimerRef.current = window.setInterval(() => {
            const elapsed = performance.now() - start;
            const frac = Math.max(0, Math.min(1, elapsed / durationMs));
            const targetCount = Math.max(1, Math.ceil(frac * words.length));
            options.setAiText(words.slice(0, targetCount).join(" "));
            if (frac >= 1) clearReveal();
          }, 50);
        },
        onEnd: () => {
          options.setAiSpeaking(false);
          options.sendMessage({ type: "ai_playback_ended" });
          clearReveal();
          if (aiTextFullRef.current) options.setAiText(aiTextFullRef.current);
          options.onPlaybackEnd?.();
        },
      });
    },
    [clearReveal, options]
  );

  useEffect(() => {
    playerRef.current = new AudioPlayer();
    return () => {
      try {
        playerRef.current?.stop();
      } catch {}
      playerRef.current = null;
      clearReveal();
    };
  }, [clearReveal]);

  return {
    playerRef,
    aiTextFullRef,
    setAiTextFull,
    clearReveal,
    playQuestionAudio,
    stopPlayback,
  };
};
