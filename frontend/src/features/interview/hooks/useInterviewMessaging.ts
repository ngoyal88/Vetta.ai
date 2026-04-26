import { useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { extractSpokenText, normalizeQuestionPayload } from "./utils/questionUtils";
import { normalizeStatus, isSilentStatus, isSpeakingStatus } from "./utils/statusMapping";

type MessagingOptions = {
  sessionId: string;
  optionsRef: React.MutableRefObject<{ addBanner?: (type: string, message: string, autoDismissMs?: number | null) => number | null; removeBanner?: (id: number) => void; removeBannerByType?: (type: string) => void } | null>;
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
  persistFeedback: (payload: {
    feedback?: string;
    full?: unknown;
    duration_minutes?: number;
    questions_answered?: number;
    code_problems_attempted?: number;
  }) => void;
};

type ChunkBuffer = {
  questionId: string | number;
  totalChunks: number;
  parts: string[];
};

export const useInterviewMessaging = (options: MessagingOptions) => {
  const chunkBufferRef = useRef<ChunkBuffer | null>(null);

  const applyQuestionMetadata = useCallback(
    (message: { question?: unknown; phase?: string; spoken_text?: string }) => {
      const inner = normalizeQuestionPayload(message);
      options.setCurrentQuestion(inner ?? null);
      options.setLoadingNextProblem(false);
      if (message?.phase) {
        options.setPhase(message.phase);
      }
      options.setTranscriptInterim("");
      options.setTranscriptFinal("");

      const fullText = extractSpokenText(message) || "";
      options.aiTextFullRef.current = fullText;
      options.setAiFullText(fullText);
      options.setAiText("");
      options.setAiSpeechWpm(180);
    },
    [options]
  );

  const processAudioChunk = useCallback(
    (msg: { question_id?: string | number; chunk_index?: number; total_chunks?: number; data?: string }) => {
      const { question_id, chunk_index, total_chunks, data } = msg;
      if (question_id == null || total_chunks == null || data == null || chunk_index == null) return;
      const buf = chunkBufferRef.current;
      if (!buf || buf.questionId !== question_id) return;
      const totalChunks = buf.totalChunks;
      if (!Number.isInteger(chunk_index) || chunk_index < 0 || chunk_index >= totalChunks) return;
      if (total_chunks !== totalChunks) return;
      buf.parts[chunk_index] = data;
      const merged: string[] = [];
      for (let i = 0; i < totalChunks; i += 1) {
        const part = buf.parts[i];
        if (part == null || part === "") return;
        merged.push(part);
      }
      chunkBufferRef.current = null;
      options.playInterviewTtsBase64(merged.join(""));
    },
    [options]
  );

  const handleMessage = useCallback(
    (message: { type?: string; [key: string]: unknown }) => {
      if (!message?.type) return;

      switch (message.type) {
        case "question_chunked": {
          applyQuestionMetadata({
            question: message.question,
            phase: message.phase as string,
            spoken_text: message.spoken_text as string,
          });
          options.clearAiReveal();
          if (options.aiTextFullRef.current) {
            options.setAiText(options.aiTextFullRef.current);
          }
          const n = (message.total_chunks as number) ?? 0;
          if (n > 0 && message.question_id) {
            chunkBufferRef.current = {
              questionId: message.question_id as string | number,
              totalChunks: n,
              parts: [],
            };
          } else {
            chunkBufferRef.current = null;
          }
          toast.success("New question received");
          break;
        }

        case "question": {
          applyQuestionMetadata(message as { question?: unknown; phase?: string; spoken_text?: string });
          options.clearAiReveal();
          if (options.aiTextFullRef.current) {
            options.setAiText(options.aiTextFullRef.current);
          }
          if (message.audio && typeof message.audio === "string") {
            options.playInterviewTtsBase64(message.audio as string);
          } else if (options.aiTextFullRef.current) {
            options.setAiText(options.aiTextFullRef.current);
          }
          toast.success("New question received");
          break;
        }

        case "transcript": {
          const text = (message.text as string) || "";
          if (message.is_final) {
            options.setTranscriptFinal((prev) => {
              if (!text) return prev;
              return prev ? `${prev} ${text}` : text;
            });
            options.setTranscriptInterim("");
          } else {
            options.setTranscriptInterim(text);
          }
          break;
        }

        case "status": {
          const nextStatus = message.status as string;
          options.setStatus((prev) => normalizeStatus(prev as string, nextStatus));
          if (isSpeakingStatus(nextStatus)) {
            options.setAiSpeakingState(true);
          } else if (isSilentStatus(nextStatus)) {
            options.setAiSpeakingState(false);
          }
          break;
        }

        case "interviewer_thinking":
          options.setStatus("thinking");
          options.setTranscriptFinal("");
          options.setTranscriptInterim("");
          break;

        case "audio_started":
          options.onPlaybackStart?.();
          options.setStatus("speaking");
          options.setAiSpeakingState(true);
          break;

        case "audio_ended":
          options.onPlaybackEnd?.();
          options.setStatus("listening");
          options.setAiSpeakingState(false);
          break;

        case "phase_change":
          options.setPhase(message.phase as string);
          if (message.phase === "dsa") {
            toast.success("Switching to coding challenge!", { duration: 3000 });
          }
          break;

        case "tts_stream_cancelled":
        case "interrupt_ack":
          if (!message.stream_id || message.stream_id === options.activeTtsStreamIdRef.current) {
            options.stopAiPlaybackLocally(null);
          }
          break;

        case "ai_transcript": {
          const aiTxt = (message.text as string) || "";
          if (aiTxt) {
            options.aiTextFullRef.current = aiTxt;
            options.setAiFullText(aiTxt);
            options.setAiText(aiTxt);
            options.setTranscriptInterim("");
            options.setTranscriptFinal("");
          }
          break;
        }

        case "feedback": {
          const payload = {
            feedback: message.feedback as string,
            full: message.full,
            duration_minutes: message.duration_minutes as number,
            questions_answered: message.questions_answered as number,
            code_problems_attempted: message.code_problems_attempted as number,
          };
          options.setFeedback(payload);
          options.persistFeedback(payload);
          toast.success("Interview completed!");
          break;
        }

        case "pong":
          break;

        case "heartbeat":
          options.onHeartbeat?.();
          break;

        case "reconnecting_stt": {
          const attempt = (message.attempt as number) ?? 1;
          const addBanner = options.optionsRef.current?.addBanner;
          if (typeof addBanner === "function") {
            addBanner("warning", `Voice recognition reconnecting (${attempt} of 3)...`);
          }
          break;
        }

        case "stt_restored": {
          const addBanner = options.optionsRef.current?.addBanner;
          const removeBannerByType = options.optionsRef.current?.removeBannerByType;
          if (typeof removeBannerByType === "function") removeBannerByType("warning");
          if (typeof addBanner === "function") addBanner("success", "Voice recognition restored.", 3000);
          options.setSttFallbackActive(false);
          break;
        }

        case "stt_unavailable": {
          options.setSttFallbackActive(true);
          const addBanner = options.optionsRef.current?.addBanner;
          if (typeof addBanner === "function") {
            addBanner("warning", "Voice recognition is unavailable. Use the text box below to type your answer.");
          }
          break;
        }

        case "error":
          options.setError(message.message as string);
          toast.error(`Error: ${message.message as string}`);
          break;

        default:
          break;
      }
    },
    [applyQuestionMetadata, options]
  );

  return {
    handleMessage,
    processAudioChunk,
  };
};
