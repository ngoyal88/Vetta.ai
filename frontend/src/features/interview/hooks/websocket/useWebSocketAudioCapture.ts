import { useCallback, useEffect, useRef } from "react";
import { AudioRecorder } from "shared/utils/audioUtils";
import type { UseWebSocketAudioCaptureOptions } from "../../types";

export const useWebSocketAudioCapture = (options: UseWebSocketAudioCaptureOptions) => {
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioLevelIntervalRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);

  const startAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current != null) {
      window.clearInterval(audioLevelIntervalRef.current);
    }
    audioLevelIntervalRef.current = window.setInterval(() => {
      const level = recorderRef.current?.getAudioLevel?.() ?? 0;
      options.setAudioLevel(level);
    }, 100);
  }, [options]);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current != null) {
      window.clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    options.setAudioLevel(0);
  }, [options]);

  const startRecording = useCallback(async () => {
    if (!options.micEnabledRef.current || !options.connectedRef.current || options.isAiSpeakingRef.current) {
      return false;
    }
    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
      }
      await recorderRef.current.start(
        (audioChunk: Blob) => {
          if (!options.connectedRef.current || options.isAiSpeakingRef.current) return;
          audioChunk.arrayBuffer().then((buffer) => options.sendBinary(buffer));
        },
        { enableVAD: false }
      );
      isRecordingRef.current = true;
      options.setIsRecording(true);
      options.sendMessage({ type: "start_recording" });
      startAudioLevelMonitoring();
      return true;
    } catch {
      return false;
    }
  }, [options, startAudioLevelMonitoring]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !isRecordingRef.current) return;
    await recorderRef.current.stop();
    isRecordingRef.current = false;
    options.setIsRecording(false);
    stopAudioLevelMonitoring();
    options.sendMessage({ type: "stop_recording" });
  }, [options, stopAudioLevelMonitoring]);

  const cleanup = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.cleanup();
      recorderRef.current = null;
    }
    isRecordingRef.current = false;
    stopAudioLevelMonitoring();
  }, [stopAudioLevelMonitoring]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    recorderRef,
    isRecordingRef,
    startRecording,
    stopRecording,
    cleanup,
  };
};
