import { useCallback } from "react";
import { isCodingPhase } from "features/interview/domain/modeContract";
import toast from "react-hot-toast";
import { extractSpokenText, normalizeQuestionPayload } from "../utils/questionUtils";
import { isSilentStatus, isSpeakingStatus, normalizeStatus } from "../utils/statusMapping";
import { persistFeedback } from "../utils/feedbackPersistence";
import type { UseWebSocketMessagingOptions } from "features/interview/types";

export const useWebSocketMessaging = (options: UseWebSocketMessagingOptions) => {
  const handleMessage = useCallback(
    (message: Record<string, unknown>) => {
      const type = message.type;
      if (typeof type !== "string") return;
      switch (type) {
        case "question": {
          const normalized = normalizeQuestionPayload({
            question: message.question,
            phase: message.phase as string | undefined,
            spoken_text: message.spoken_text as string | undefined,
          });
          options.setCurrentQuestion(normalized);
          options.setLoadingNextProblem(false);
          if (typeof message.phase === "string") {
            options.setPhase(message.phase);
          }
          options.setTranscriptInterim("");
          options.setTranscriptFinal("");
          const fullText = extractSpokenText({
            question: message.question,
            spoken_text: message.spoken_text as string | undefined,
          });
          options.setAiTextFull(fullText);
          options.clearReveal();
          options.setAiText("");

          const audio = typeof message.audio === "string" ? message.audio : null;
          if (audio) {
            options.setAiSpeaking(true);
            options.playQuestionAudio(audio);
          } else {
            options.setAiText(fullText);
          }
          toast.success("New question received");
          break;
        }
        case "transcript": {
          const text = typeof message.text === "string" ? message.text : "";
          if (message.is_final) {
            options.setTranscriptFinal((prev) => `${prev} ${text}`.trim());
            options.setTranscriptInterim("");
          } else {
            options.setTranscriptInterim(text);
          }
          break;
        }
        case "status": {
          const nextStatus = typeof message.status === "string" ? message.status : "connected";
          options.setStatus((prev) => normalizeStatus(String(prev), nextStatus));
          if (isSpeakingStatus(nextStatus)) {
            options.setAiSpeaking(true);
          } else if (isSilentStatus(nextStatus)) {
            options.setAiSpeaking(false);
          }
          break;
        }
        case "phase_change":
          if (typeof message.phase === "string") {
            options.setPhase(message.phase);
            if (isCodingPhase(message.phase)) {
              toast.success("Switching to coding challenge!", { duration: 3000 });
            }
          }
          break;
        case "silence_warning": {
          const tier = Number(message.tier) || 1;
          const secondsSilent = Number(message.seconds_silent) || 0;
          options.setSilenceWarning?.({ tier, secondsSilent, ending: Boolean(message.ending) });
          if (message.ending) {
            options.onInterviewEnded?.({ completion_reason: "silence_timeout" });
          }
          break;
        }
        case "interview_ended":
          options.onInterviewEnded?.({
            completion_reason: (message.completion_reason as string) || "ended_early",
          });
          break;
        case "session_status": {
          if (message.status === "ended") {
            const reason = (message.completion_reason as string) || "ended_early";
            if (message.final_feedback || message.full) {
              const payload = {
                feedback: message.final_feedback as string | undefined,
                full: message.full,
                completion_reason: reason,
              };
              options.setFeedback(payload);
              persistFeedback(options.sessionId, payload);
            }
            options.onInterviewEnded?.({ completion_reason: reason });
          }
          break;
        }
        case "feedback": {
          const payload = {
            feedback: message.feedback as string | undefined,
            full: message.full,
            duration_minutes: message.duration_minutes as number | undefined,
            questions_answered: message.questions_answered as number | undefined,
            code_problems_attempted: message.code_problems_attempted as number | undefined,
            completion_reason: message.completion_reason as string | undefined,
          };
          options.setFeedback(payload);
          persistFeedback(options.sessionId, payload);
          options.onInterviewEnded?.({
            completion_reason: (message.completion_reason as string) || "ended_early",
          });
          toast.success("Interview completed!");
          break;
        }
        case "reconnecting_stt":
        case "stt_reconnecting":
          options.setSttReconnecting?.(true);
          break;
        case "stt_restored":
          options.setSttReconnecting?.(false);
          options.setSttFallbackActive?.(false);
          break;
        case "stt_unavailable":
          options.setSttFallbackActive?.(true);
          break;
        case "heartbeat":
        case "pong":
          break;
        case "error": {
          const msg = typeof message.message === "string" ? message.message : "Unknown error";
          options.setError(msg);
          toast.error(`Error: ${msg}`);
          break;
        }
        default:
          break;
      }
    },
    [options]
  );

  return {
    handleMessage,
  };
};
