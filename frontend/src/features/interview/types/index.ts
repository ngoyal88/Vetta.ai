import type { Room } from "livekit-client";
import type React from "react";

export type BannerHandler = (type: string, message: string, autoDismissMs?: number | null) => number | null;

export type BannerOptions = {
  addBanner?: BannerHandler;
  removeBanner?: (id: number) => void;
  removeBannerByType?: (type: string) => void;
};

export type CodeEditorHandle = {
  getValue?: () => string;
  setValue?: (value: string) => void;
  getLanguage?: () => string;
  setLanguage?: (lang: string) => void;
};

export type LiveKitOptions = BannerOptions & {
  codeEditorRef?: { current?: CodeEditorHandle | null };
  onInterviewEnded?: (payload?: { completion_reason?: string }) => void;
  sendControl?: (message: unknown) => void;
  syncSessionStatus?: () => Promise<{ ended?: boolean; reason?: string } | void>;
  connected?: boolean;
};

export type FeedbackPayload = {
  feedback?: string;
  full?: unknown;
  duration_minutes?: number;
  questions_answered?: number;
  code_problems_attempted?: number;
  completion_reason?: string;
};

export type QuestionPayload = {
  question?: unknown;
  phase?: string;
  spoken_text?: string;
};

export type ChunkBuffer = {
  questionId: string | number;
  totalChunks: number;
  parts: string[];
};

export type InterruptOptions = {
  energyThreshold: number;
  holdMs: number;
  debounceMs: number;
  minPlaybackMs: number;
};

export type AudioCaptureOptions = {
  sendControl: (message: unknown) => void;
  setAudioLevel: (value: number) => void;
  setIsRecording: (value: boolean) => void;
  isAiSpeakingRef: React.MutableRefObject<boolean>;
  micEnabledRef: React.MutableRefObject<boolean>;
  roomRef?: React.MutableRefObject<{ state?: string } | null>;
  onInterrupt: () => void;
  checkForInterrupt: (level: number, isAiSpeaking: boolean, onInterrupt: () => void) => void;
  onError?: (error: Error) => void;
};

export type PlaybackOptions = {
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

export type MessagingOptions = {
  sessionId: string;
  optionsRef: React.MutableRefObject<LiveKitOptions | null>;
  aiTextFullRef: React.MutableRefObject<string>;
  activeTtsStreamIdRef: React.MutableRefObject<string | null>;
  playInterviewTtsBase64: (audio: string | null) => void;
  stopAiPlaybackLocally: (messageType: string | null) => void;
  clearAiReveal: () => void;
  sendControl: (message: unknown) => void;
  setCurrentQuestion: (value: unknown) => void;
  setLoadingNextProblem: (value: boolean) => void;
  setPhase: (value: string) => void;
  setTranscriptInterim: (value: string) => void;
  setTranscriptFinal: (value: string | ((prev: string) => string)) => void;
  setAiText: (value: string) => void;
  setAiFullText: (value: string) => void;
  setAiSpeechWpm: (value: number) => void;
  setAiSpeakingState: (value: boolean) => void;
  setFeedback: (value: unknown) => void;
  setError: (value: string) => void;
  setStatus: (value: string | ((prev: string) => string)) => void;
  setSttFallbackActive: (value: boolean) => void;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onHeartbeat?: () => void;
  persistFeedback: (payload: FeedbackPayload) => void;
  onInterviewEnded?: (payload?: { completion_reason?: string }) => void;
  setSilenceWarning?: (payload: { tier: number; secondsSilent: number; ending?: boolean }) => void;
  setSttReconnecting?: (value: boolean) => void;
  onTranscriptReceived?: () => void;
};

export type OptionsRef = React.MutableRefObject<LiveKitOptions | null>;

export type TransportOptions = {
  sessionId: string;
  onMessage: (message: unknown) => void;
  onAudioChunk: (message: unknown) => void;
  onReconnectSuccess?: () => void;
  onAudioUnlockPrompt?: () => void;
  onAudioUnlocked?: () => void;
  addBanner?: BannerHandler;
  micEnabledRef?: React.MutableRefObject<boolean>;
  roomRef?: React.MutableRefObject<Room | null>;
};

export type UseWebSocketTransportOptions = {
  sessionId: string;
  onMessage: (message: Record<string, unknown>) => void;
};

export type UseWebSocketAudioCaptureOptions = {
  sendBinary: (data: ArrayBuffer) => void;
  sendMessage: (message: unknown) => void;
  setAudioLevel: (value: number) => void;
  setIsRecording: (value: boolean) => void;
  isAiSpeakingRef: React.MutableRefObject<boolean>;
  micEnabledRef: React.MutableRefObject<boolean>;
  connectedRef: React.MutableRefObject<boolean>;
};

export type UseWebSocketAudioPlaybackOptions = {
  setAiSpeaking: (value: boolean) => void;
  setAiText: (value: string) => void;
  setAiFullText: (value: string) => void;
  setAiSpeechWpm: (value: number) => void;
  sendMessage: (message: unknown) => void;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
};

export type UseWebSocketMessagingOptions = {
  sessionId: string;
  setCurrentQuestion: (value: unknown) => void;
  setLoadingNextProblem: (value: boolean) => void;
  setPhase: (value: string) => void;
  setTranscriptInterim: (value: string) => void;
  setTranscriptFinal: (value: string | ((prev: string) => string)) => void;
  setAiText: (value: string) => void;
  setAiSpeaking: (value: boolean) => void;
  setFeedback: (value: unknown) => void;
  setError: (value: string | null) => void;
  setStatus: (value: string | ((prev: string) => string)) => void;
  setAiTextFull: (value: string) => void;
  clearReveal: () => void;
  playQuestionAudio: (audioBase64: string | null) => void;
  onInterviewEnded?: (payload?: { completion_reason?: string }) => void;
  setSilenceWarning?: (payload: { tier: number; secondsSilent: number; ending?: boolean }) => void;
  setSttFallbackActive?: (value: boolean) => void;
  setSttReconnecting?: (value: boolean) => void;
};

export type UseWebSocketSessionEffectsOptions = {
  sessionId: string;
  isRecording: boolean;
  micEnabled: boolean;
  connect: () => void | Promise<void>;
  disconnect: () => void;
  recorderRef: React.MutableRefObject<{ pause: () => void; resume: () => void } | null>;
  setError: (value: string | null) => void;
};
