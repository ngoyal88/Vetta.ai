import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import toast from "react-hot-toast";
import { api } from "shared/services/api";
import { useWebSocketTransport } from "./useWebSocketTransport";
import { useWebSocketAudioCapture } from "./useWebSocketAudioCapture";
import { useWebSocketAudioPlayback } from "./useWebSocketAudioPlayback";
import { useWebSocketMessaging } from "./useWebSocketMessaging";
import { useWebSocketSessionEffects } from "./useWebSocketSessionEffects";

export const useInterviewWebSocketAdapter = (sessionId: string, initialPhase = "behavioral") => {
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
  const [isRecording, setIsRecording] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);

  const connectedRef = useRef(false);
  const micEnabledRef = useRef(true);
  const aiSpeakingRef = useRef(false);

  const messagingRef = useRef<(message: Record<string, unknown>) => void>(() => {});

  const transport = useWebSocketTransport({
    sessionId,
    onMessage: (message) => messagingRef.current(message),
  });

  const capture = useWebSocketAudioCapture({
    sendBinary: transport.sendBinary,
    sendMessage: transport.sendMessage,
    setAudioLevel,
    setIsRecording,
    isAiSpeakingRef: aiSpeakingRef,
    micEnabledRef,
    connectedRef,
  });

  const playback = useWebSocketAudioPlayback({
    setAiSpeaking,
    setAiText,
    setAiFullText,
    setAiSpeechWpm,
    sendMessage: transport.sendMessage,
    onPlaybackStart: () => {
      if (capture.isRecordingRef.current) {
        capture.recorderRef.current?.pause();
      }
    },
    onPlaybackEnd: () => {
      if (micEnabledRef.current && capture.isRecordingRef.current) {
        capture.recorderRef.current?.resume();
      }
    },
  });

  const messaging = useWebSocketMessaging({
    sessionId,
    setCurrentQuestion,
    setLoadingNextProblem,
    setPhase,
    setTranscriptInterim,
    setTranscriptFinal,
    setAiText,
    setAiSpeaking,
    setFeedback,
    setError: transport.setError,
    setStatus: transport.setStatus,
    setAiTextFull: playback.setAiTextFull,
    clearReveal: playback.clearReveal,
    playQuestionAudio: playback.playQuestionAudio,
  });

  messagingRef.current = messaging.handleMessage;

  useWebSocketSessionEffects({
    sessionId,
    isRecording,
    micEnabled,
    connect: transport.connect,
    disconnect: () => {
      playback.stopPlayback();
      capture.cleanup();
      transport.disconnect();
      setIsRecording(false);
      setAiSpeaking(false);
      setAudioLevel(0);
    },
    recorderRef: capture.recorderRef as MutableRefObject<{ pause: () => void; resume: () => void } | null>,
    setError: transport.setError,
  });

  useEffect(() => {
    connectedRef.current = transport.connected;
  }, [transport.connected]);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    aiSpeakingRef.current = aiSpeaking;
  }, [aiSpeaking]);

  const startRecording = useCallback(async () => {
    if (aiSpeakingRef.current) {
      toast.error("Please wait for AI to finish speaking");
      return;
    }
    const ok = await capture.startRecording();
    if (!ok && !micEnabledRef.current) {
      toast.error("Enable the microphone first");
    }
  }, [capture]);

  const stopRecording = useCallback(async () => {
    await capture.stopRecording();
  }, [capture]);

  const submitAnswer = useCallback(async () => {
    if (!transport.connected) return;
    if (aiSpeakingRef.current) {
      toast.error("Please wait for AI to finish speaking");
      return;
    }
    if (capture.isRecordingRef.current) {
      await capture.stopRecording();
    }
    transport.sendMessage({ type: "answer_complete" });
  }, [capture, transport]);

  const toggleMicrophone = useCallback(
    async (enabled: boolean) => {
      setMicEnabled(enabled);
      micEnabledRef.current = enabled;
      if (!enabled && capture.isRecordingRef.current) {
        await capture.stopRecording();
      }
      toast.success(enabled ? "🎤 Microphone enabled" : "🔇 Microphone muted");
    },
    [capture]
  );

  const interruptAI = useCallback(() => {
    if (!aiSpeakingRef.current) return;
    playback.stopPlayback();
    transport.sendMessage({ type: "interrupt" });
    toast("AI interrupted");
    if (micEnabledRef.current) {
      window.setTimeout(() => {
        void capture.startRecording();
      }, 200);
    }
  }, [capture, playback, transport]);

  const skipQuestion = useCallback(() => {
    transport.sendMessage({ type: "skip_question" });
    toast.success("Skipping question...");
  }, [transport]);

  const requestNextDSAQuestion = useCallback(() => {
    setCurrentQuestion(null);
    setLoadingNextProblem(true);
    transport.sendMessage({ type: "dsa_next_question" });
    toast.success("Loading next problem...");
  }, [transport]);

  const endInterview = useCallback(async () => {
    transport.sendMessage({ type: "end_interview" });
    try {
      await api.completeInterview(sessionId);
    } catch {}
  }, [sessionId, transport]);

  const disconnect = useCallback(() => {
    playback.stopPlayback();
    capture.cleanup();
    transport.disconnect();
  }, [capture, playback, transport]);

  return {
    connected: transport.connected,
    status: transport.status,
    error: transport.error,
    networkIssue: transport.networkIssue,
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
    disconnect,
    sendMessage: transport.sendMessage,
    startInterview: () => transport.sendMessage({ type: "start" }),
  };
};
