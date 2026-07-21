import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { checkBrowserSupport } from "shared/utils/audioUtils";
import toast from "react-hot-toast";
import { api } from "shared/services/api";
import { useAudioPlayback } from "../useAudioPlayback";
import { useAudioCapture } from "../useAudioCapture";
import { useTransportConnection } from "../useTransportConnection";
import { useInterviewMessaging } from "../useInterviewMessaging";
import { useInterruptDetection } from "../useInterruptDetection";
import { useSessionPersistence } from "../useSessionPersistence";
import { useUIEffects } from "../useUIEffects";
import { loadFeedback, persistFeedback } from "../utils/feedbackPersistence";
import type { MicHealth } from "features/interview/preflight/MicHealthIndicator";
import type { FeedbackPayload, LiveKitOptions } from "features/interview/types";

const MIC_RESUME_DELAY_MS = 250;
const INTERRUPT_ENERGY_THRESHOLD = 0.008;
const INTERRUPT_HOLD_MS = 180;
const INTERRUPT_DEBOUNCE_MS = 2000;
const MIN_PLAYBACK_BEFORE_INTERRUPT_MS = 2000;
const isDev = import.meta.env.DEV;

const isEditableElement = (target: EventTarget | null) => {
  if (!target) return false;
  const el = target as HTMLElement;
  const tagName = el.tagName?.toLowerCase?.();
  return (
    (el as HTMLElement).isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    !!el.closest?.(".monaco-editor")
  );
};

export const useInterviewLiveKitAdapter = (sessionId: string, initialPhase = "behavioral", options: LiveKitOptions = {}) => {
  const optionsRef = useRef<LiveKitOptions | null>(options);
  optionsRef.current = options;

  const [status, setStatus] = useState("disconnected");
  const [currentQuestion, setCurrentQuestion] = useState<unknown>(null);
  const [loadingNextProblem, setLoadingNextProblem] = useState(false);
  const [phase, setPhase] = useState(initialPhase);
  const [transcriptInterim, setTranscriptInterim] = useState("");
  const [transcriptFinal, setTranscriptFinal] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiFullText, setAiFullText] = useState("");
  const [aiSpeechWpm, setAiSpeechWpm] = useState(180);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [sttFallbackActive, setSttFallbackActive] = useState(false);
  const [sttReconnecting, setSttReconnecting] = useState(false);
  const [silenceWarning, setSilenceWarning] = useState<{
    tier: number;
    secondsSilent: number;
    ending?: boolean;
  } | null>(null);
  const lastTranscriptAtRef = useRef<number | null>(null);
  const interviewEndedRef = useRef(false);

  const aiSpeakingRef = useRef(false);
  const micEnabledRef = useRef(true);
  const roomRef = useRef<Room | null>(null);
  const sendControlRef = useRef<(message: unknown) => void>(() => {});
  const lastHeartbeatRef = useRef(0);
  const heartbeatWarningRef = useRef<number | null>(null);
  const audioUnlockedRef = useRef(false);
  const stopAiPlaybackRef = useRef<(messageType: string | null) => void>(() => {});
  const connectRef = useRef<() => void>(() => {});
  const disconnectRef = useRef<() => void>(() => {});

  const { addBanner, removeBanner } = useUIEffects(optionsRef);

  const { markPlaybackStart, clearPlaybackStart, checkForInterrupt } = useInterruptDetection({
    energyThreshold: INTERRUPT_ENERGY_THRESHOLD,
    holdMs: INTERRUPT_HOLD_MS,
    debounceMs: INTERRUPT_DEBOUNCE_MS,
    minPlaybackMs: MIN_PLAYBACK_BEFORE_INTERRUPT_MS,
  });

  const sendControlProxy = useCallback((message: unknown) => {
    sendControlRef.current(message);
  }, []);

  const { recorderRef, ensureRecorderStarted, stopRecording, cleanup: cleanupRecording, isRecordingRef } = useAudioCapture({
    sendControl: sendControlProxy,
    setAudioLevel,
    setIsRecording,
    isAiSpeakingRef: aiSpeakingRef,
    micEnabledRef,
    roomRef,
    onInterrupt: () => stopAiPlaybackRef.current("user_speech_during_ai"),
    checkForInterrupt,
    onError: (err) => toast.error(err.message || "Failed to start microphone streaming"),
  });

  const scheduleMicResume = useCallback((delayMs = MIC_RESUME_DELAY_MS) => {
    if (!micEnabledRef.current) return;
    recorderRef.current?.resume(delayMs);
  }, [recorderRef]);

  const setAiSpeakingState = useCallback((nextValue: boolean) => {
    aiSpeakingRef.current = nextValue;
    setAiSpeaking(nextValue);
  }, []);

  const { aiTextFullRef, activeTtsStreamIdRef, clearAiReveal, playInterviewTtsBase64, stopAiPlaybackLocally } =
    useAudioPlayback({
      setAiSpeakingState,
      setAiText,
      setAiFullText,
      setAiSpeechWpm,
      setStatus,
      sendControl: sendControlProxy,
      scheduleMicResume,
      onPlaybackEnd: () => {
        clearPlaybackStart();
      },
      onLocalPlaybackStart: () => {
        if (isRecordingRef.current) {
          recorderRef.current?.pause();
        }
      },
    });

  useEffect(() => {
    stopAiPlaybackRef.current = stopAiPlaybackLocally;
  }, [stopAiPlaybackLocally]);

  const persistFeedbackPayload = useCallback(
    (payload: FeedbackPayload) => persistFeedback(sessionId, payload),
    [sessionId]
  );

  const syncSessionStatus = useCallback(async () => {
    if (!sessionId) return { ended: false };
    try {
      const data = await api.getSessionDetails(sessionId);
      const status = String(data.status || "");
      const ended = ["ended_early", "completed", "incomplete_exit"].includes(status);
      if (ended) {
        const stored = loadFeedback(sessionId);
        if (stored) {
          setFeedback(stored);
        } else if (data.final_feedback) {
          const ff = data.final_feedback;
          const payload: FeedbackPayload = {
            feedback: typeof ff === "object" ? (ff.feedback as string) : String(ff),
            full: ff,
            completion_reason: data.completion_reason as string | undefined,
          };
          setFeedback(payload);
          persistFeedbackPayload(payload);
        }
        interviewEndedRef.current = true;
        optionsRef.current?.onInterviewEnded?.({
          completion_reason: (data.completion_reason as string) || status,
        });
        return { ended: true, reason: (data.completion_reason as string) || status };
      }
      return { ended: false };
    } catch {
      return { ended: false };
    }
  }, [sessionId, persistFeedbackPayload]);

  const {
    handleMessage,
    processAudioChunk,
  } = useInterviewMessaging({
    sessionId,
    optionsRef,
    aiTextFullRef,
    activeTtsStreamIdRef,
    playInterviewTtsBase64,
    stopAiPlaybackLocally,
    clearAiReveal,
    sendControl: sendControlProxy,
    setCurrentQuestion,
    setLoadingNextProblem,
    setPhase,
    setTranscriptInterim,
    setTranscriptFinal,
    setAiText,
    setAiFullText,
    setAiSpeechWpm,
    setAiSpeakingState,
    setFeedback,
    setError,
    setStatus,
    setSttFallbackActive,
    onPlaybackStart: markPlaybackStart,
    onPlaybackEnd: clearPlaybackStart,
    onHeartbeat: () => {
      lastHeartbeatRef.current = Date.now();
      if (heartbeatWarningRef.current != null) {
        removeBanner(heartbeatWarningRef.current);
        heartbeatWarningRef.current = null;
      }
    },
    persistFeedback: persistFeedbackPayload,
    setSilenceWarning,
    setSttReconnecting,
    onTranscriptReceived: () => {
      lastTranscriptAtRef.current = Date.now();
      setSilenceWarning(null);
    },
    onInterviewEnded: (payload) => {
      interviewEndedRef.current = true;
      optionsRef.current?.onInterviewEnded?.(payload);
    },
  });

  const {
    connected,
    error: transportError,
    networkIssue,
    reconnecting,
    reconnectAttempt,
    remoteAudioElsRef,
    sendControl,
    connect,
    disconnect: transportDisconnect,
  } = useTransportConnection({
    sessionId,
    onMessage: handleMessage,
    onAudioChunk: processAudioChunk,
    onReconnectSuccess: () => restoreCodeToEditor(true),
    addBanner,
    micEnabledRef,
    roomRef,
  });

  const { handleVisibilityChange, restoreCodeToEditor } = useSessionPersistence(
    sessionId,
    optionsRef,
    {
      sendControl: sendControlProxy,
      syncSessionStatus,
      connected,
    }
  );

  useEffect(() => {
    if (transportError) setError(transportError);
  }, [transportError]);

  useEffect(() => {
    sendControlRef.current = sendControl;
  }, [sendControl]);

  useEffect(() => {
    optionsRef.current = {
      ...options,
      sendControl,
      syncSessionStatus,
      connected,
    };
  }, [options, sendControl, syncSessionStatus, connected]);

  useEffect(() => {
    if (!sessionId) return;
    const stored = loadFeedback(sessionId);
    if (stored) {
      setFeedback(stored);
      interviewEndedRef.current = true;
      optionsRef.current?.onInterviewEnded?.({
        completion_reason: stored.completion_reason,
      });
      return;
    }
    void syncSessionStatus();
  }, [sessionId, syncSessionStatus]);

  const micHealth: MicHealth = useMemo(() => {
    if (sttReconnecting) return "reconnecting";
    if (sttFallbackActive) return "no_signal";
    if (audioLevel > 0.02) return "ok";
    if (lastTranscriptAtRef.current && Date.now() - lastTranscriptAtRef.current < 60_000) {
      return "ok";
    }
    if (audioLevel > 0.005) return "quiet";
    return "no_signal";
  }, [audioLevel, sttFallbackActive, sttReconnecting]);

  useEffect(() => {
    const support = checkBrowserSupport();
    if (!support.supported) {
      const missing = Object.entries(support.features)
        .filter(([, supported]) => !supported)
        .map(([feature]) => feature);
      setError(`Browser not supported. Missing: ${missing.join(", ")}`);
      toast.error("Browser not supported for voice interviews");
    }
  }, []);

  useEffect(() => {
    if (!connected) return undefined;
    const unlockAudioAndMic = async () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      try {
        await roomRef.current?.startAudio();
      } catch (_) {}
      toast.dismiss("audio-unlock");
      remoteAudioElsRef.current?.forEach(({ el }) => {
        el.play?.().catch(() => {});
      });
      try {
        await ensureRecorderStarted();
      } catch (_) {}
    };
    window.addEventListener("pointerdown", unlockAudioAndMic, { once: true });
    window.addEventListener("keydown", unlockAudioAndMic, { once: true });
    window.addEventListener("touchstart", unlockAudioAndMic, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudioAndMic);
      window.removeEventListener("keydown", unlockAudioAndMic);
      window.removeEventListener("touchstart", unlockAudioAndMic);
    };
  }, [connected, ensureRecorderStarted, remoteAudioElsRef, roomRef]);

  useEffect(() => {
    if (!connected || !sessionId) return;
    const onVisibility = () => {
      handleVisibilityChange(
        () => {
          try {
            const ctx = (recorderRef.current as { audioContext?: AudioContext | null } | null)
              ?.audioContext;
            if (ctx?.state === "running") {
              ctx.suspend();
            }
          } catch (_) {}
        },
        () => {
          try {
            const ctx = (recorderRef.current as { audioContext?: AudioContext | null } | null)
              ?.audioContext;
            if (ctx?.state === "suspended") {
              ctx.resume();
            }
          } catch (_) {}
        }
      );
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [connected, handleVisibilityChange, recorderRef, sessionId, sendControl, syncSessionStatus]);

  useEffect(() => {
    if (!connected) return;
    const HEARTBEAT_CHECK_MS = 10000;
    const HEARTBEAT_STALE_MS = 30000;
    const interval = window.setInterval(() => {
      if (lastHeartbeatRef.current === 0) return;
      if (Date.now() - lastHeartbeatRef.current <= HEARTBEAT_STALE_MS) return;
      if (heartbeatWarningRef.current != null) return;
      heartbeatWarningRef.current = addBanner(
        "warning",
        "Connection to your interviewer may be unstable."
      );
    }, HEARTBEAT_CHECK_MS);
    return () => window.clearInterval(interval);
  }, [addBanner, connected]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phase === "greeting") return;
      if (aiSpeaking) return;
      if (!connected) return;
      if (isEditableElement(event.target)) return;
      if (event.code !== "Space" && event.code !== "Enter") return;
      event.preventDefault();
      if (event.code === "Space") {
        sendControl({ type: "hint_done_speaking" });
      } else {
        sendControl({ type: "answer_complete" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aiSpeaking, connected, phase, sendControl]);

  const disconnectLocal = useCallback(() => {
    try {
      stopAiPlaybackLocally(null);
    } catch (_) {}
    audioUnlockedRef.current = false;
    cleanupRecording();
    transportDisconnect();
    setIsRecording(false);
    setAiSpeakingState(false);
    setStatus("disconnected");
    setAudioLevel(0);
  }, [cleanupRecording, setAiSpeakingState, stopAiPlaybackLocally, transportDisconnect]);

  connectRef.current = connect;
  disconnectRef.current = disconnectLocal;

  useEffect(() => {
    if (!sessionId) return;
    connectRef.current?.();
    return () => disconnectRef.current?.();
  }, [sessionId]);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    aiSpeakingRef.current = aiSpeaking;
  }, [aiSpeaking]);

  const startRecording = useCallback(async () => {
    if (!micEnabledRef.current) {
      toast.error("Enable the microphone first");
      return;
    }
    if (!connected) return;
    await ensureRecorderStarted();
  }, [connected, ensureRecorderStarted]);

  const submitAnswer = useCallback(() => {
    if (!connected) return;
    if (aiSpeakingRef.current) {
      toast.error("Please wait for AI to finish speaking");
      return;
    }
    sendControl({ type: "hint_done_speaking" });
    setTranscriptInterim("");
    setTranscriptFinal("");
  }, [connected, sendControl]);

  const toggleMicrophone = useCallback(
    async (enabled: boolean) => {
      micEnabledRef.current = enabled;
      setMicEnabled(enabled);
      const pubs = roomRef.current?.localParticipant?.getTrackPublications?.() ?? [];
      for (const pub of pubs) {
        if (pub.kind === "audio") {
          const publication = pub as any;
          if (enabled) {
            await publication.unmute();
          } else {
            await publication.mute();
          }
        }
      }
      toast.success(enabled ? "Microphone enabled" : "Microphone muted");
    },
    [roomRef]
  );

  const interruptAI = useCallback(() => {
    if (!aiSpeakingRef.current) return;
    stopAiPlaybackLocally("interrupt");
    toast("AI interrupted");
  }, [stopAiPlaybackLocally]);

  const skipQuestion = useCallback(() => {
    sendControl({ type: "skip_question" });
    toast.success("Skipping question...");
  }, [sendControl]);

  const requestNextDSAQuestion = useCallback(() => {
    setCurrentQuestion(null);
    setLoadingNextProblem(true);
    sendControl({ type: "coding_next_question" });
    toast.success("Loading next problem...");
  }, [sendControl]);

  const endInterview = useCallback(async () => {
    sendControl({ type: "end_interview" });
    try {
      await api.completeInterview(sessionId);
    } catch (err) {
      if (isDev) console.error("REST completion failed", err);
    }
  }, [sendControl, sessionId]);

  return {
    connected,
    status,
    error,
    networkIssue,
    currentQuestion,
    loadingNextProblem,
    phase,
    transcriptInterim,
    transcriptFinal,
    aiText,
    aiFullText,
    aiSpeechWpm,
    aiSpeaking,
    feedback,
    isRecording,
    micEnabled,
    audioLevel,
    startRecording,
    stopRecording,
    submitAnswer,
    toggleMicrophone,
    interruptAI,
    skipQuestion,
    requestNextDSAQuestion,
    endInterview,
    disconnect: disconnectLocal,
    sendControl,
    sendMessage: sendControl,
    startInterview: () => sendControl({ type: "start" }),
    fallbackToWebSocket: () => {
      try {
        sessionStorage.setItem("force_ws", "1");
        window.location.href = `/interview/${sessionId}?transport=ws`;
      } catch (_) {
        window.location.href = `/interview/${sessionId}`;
      }
    },
    reconnecting,
    reconnectAttempt,
    sttFallbackActive,
    setSttFallbackActive,
    sttReconnecting,
    silenceWarning,
    micHealth,
    syncSessionStatus,
    remoteAudioElsRef,
  };
};
