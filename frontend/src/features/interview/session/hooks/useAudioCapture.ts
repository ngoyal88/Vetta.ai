import { useCallback, useEffect, useRef } from "react";
import { AudioRecorder } from "shared/utils/audioUtils";
import type { AudioCaptureOptions } from "features/interview/types";

export const useAudioCapture = (options: AudioCaptureOptions) => {
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioLevelIntervalRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const startInFlightRef = useRef(false);

  const ensureRecorderStarted = useCallback(async () => {
    if (!options.micEnabledRef.current) return false;
    const room = options.roomRef?.current;
    if (room && room.state !== "connected") return false;

    if (recorderRef.current && isRecordingRef.current) {
      recorderRef.current.resume(options.isAiSpeakingRef.current ? 250 : 0);
      return true;
    }

    if (startInFlightRef.current) return false;
    startInFlightRef.current = true;
    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
      }

      const started = await recorderRef.current.start(
        () => {
          const room = options.roomRef?.current;
          if (room && room.state !== "connected") return;
          if (!options.micEnabledRef.current) return;
          const level = recorderRef.current?.getAudioLevel?.() ?? 0;
          options.setAudioLevel(level);
          options.checkForInterrupt(level, options.isAiSpeakingRef.current, options.onInterrupt);
        },
        {
          enableVAD: true,
          silenceThreshold: 0.02,
          silenceDuration: 1800,
          onSpeechStart: () => options.sendControl({ type: "speech_started" }),
          onSpeechEnd: () => options.sendControl({ type: "speech_ended" }),
        }
      );

      if (!started) return false;

      isRecordingRef.current = true;
      options.setIsRecording(true);
      options.sendControl({ type: "start_recording" });

      if (audioLevelIntervalRef.current) {
        window.clearInterval(audioLevelIntervalRef.current);
      }
      audioLevelIntervalRef.current = window.setInterval(() => {
        if (recorderRef.current) {
          options.setAudioLevel(recorderRef.current.getAudioLevel?.() ?? 0);
        }
      }, 100);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        options.onError?.(error);
      }
      return false;
    } finally {
      startInFlightRef.current = false;
    }
  }, [options]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !isRecordingRef.current) return;
    await recorderRef.current.stop();
    isRecordingRef.current = false;
    options.setIsRecording(false);
    if (audioLevelIntervalRef.current) {
      window.clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    options.setAudioLevel(0);
    options.sendControl({ type: "stop_recording" });
  }, [options]);

  const cleanup = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.cleanup();
      recorderRef.current = null;
    }
    isRecordingRef.current = false;
    if (audioLevelIntervalRef.current) {
      window.clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    options.setAudioLevel(0);
  }, [options]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    recorderRef,
    isRecordingRef,
    ensureRecorderStarted,
    stopRecording,
    cleanup,
  };
};
