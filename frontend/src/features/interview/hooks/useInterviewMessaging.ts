import { useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { extractSpokenText, normalizeQuestionPayload } from "./utils/questionUtils";
import { normalizeStatus, isSilentStatus, isSpeakingStatus } from "./utils/statusMapping";
import type { ChunkBuffer, MessagingOptions } from "../types";

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
            if (text.trim().length >= 3) {
              options.onTranscriptReceived?.();
            }
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
          if (nextStatus === "completed") {
            options.onInterviewEnded?.({ completion_reason: "ended_early" });
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

        case "silence_warning": {
          const tier = Number(message.tier) || 1;
          const secondsSilent = Number(message.seconds_silent) || 0;
          options.setSilenceWarning?.({ tier, secondsSilent, ending: Boolean(message.ending) });
          const addBanner = options.optionsRef.current?.addBanner;
          if (typeof addBanner === "function") {
            if (tier >= 3 || message.ending) {
              addBanner("warning", "No speech detected for a while. Ending the session…", 8000);
            } else if (tier === 2) {
              addBanner("info", "Still there? The interviewer can rephrase the question.", 6000);
            } else {
              addBanner("info", "Take your time — the mic is open when you are ready.", 5000);
            }
          }
          if (message.ending) {
            options.onInterviewEnded?.({ completion_reason: "silence_timeout" });
          }
          break;
        }

        case "session_status": {
          if (message.status === "ended") {
            const reason = (message.completion_reason as string) || "ended_early";
            if (message.final_feedback || message.full) {
              const payload = {
                feedback: (message.final_feedback as string) || undefined,
                full: message.full,
                completion_reason: reason,
              };
              options.setFeedback(payload);
              options.persistFeedback(payload);
            }
            options.onInterviewEnded?.({ completion_reason: reason });
          } else {
            const addBanner = options.optionsRef.current?.addBanner;
            if (typeof addBanner === "function") {
              addBanner("success", "Welcome back — session still in progress.", 4000);
            }
          }
          break;
        }

        case "interview_ended":
          options.onInterviewEnded?.({
            completion_reason: (message.completion_reason as string) || "ended_early",
          });
          break;

        case "feedback": {
          const payload = {
            feedback: message.feedback as string,
            full: message.full,
            duration_minutes: message.duration_minutes as number,
            questions_answered: message.questions_answered as number,
            code_problems_attempted: message.code_problems_attempted as number,
            completion_reason: message.completion_reason as string | undefined,
          };
          options.setFeedback(payload);
          options.persistFeedback(payload);
          options.onInterviewEnded?.({
            completion_reason: (message.completion_reason as string) || "ended_early",
          });
          toast.success(
            payload.completion_reason === "silence_timeout"
              ? "Session ended due to silence"
              : "Interview completed!"
          );
          break;
        }

        case "pong":
          break;

        case "heartbeat":
          options.onHeartbeat?.();
          break;

        case "reconnecting_stt":
        case "stt_reconnecting": {
          const attempt = (message.attempt as number) ?? 1;
          options.setSttReconnecting?.(true);
          const addBanner = options.optionsRef.current?.addBanner;
          if (typeof addBanner === "function") {
            addBanner(
              "warning",
              `Voice connection paused — reconnecting (${attempt} of 3)…`,
              6000
            );
          }
          break;
        }

        case "stt_restored": {
          options.setSttReconnecting?.(false);
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
