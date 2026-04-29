import { useCallback } from "react";
import toast from "react-hot-toast";
import { extractSpokenText, normalizeQuestionPayload } from "../utils/questionUtils";
import { isSilentStatus, isSpeakingStatus, normalizeStatus } from "../utils/statusMapping";
import { persistFeedback } from "../utils/feedbackPersistence";

type UseWebSocketMessagingOptions = {
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
};

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
            if (message.phase === "dsa") {
              toast.success("🖥️ Switching to coding challenge!", { duration: 3000 });
            }
          }
          break;
        case "feedback": {
          const payload = {
            feedback: message.feedback as string | undefined,
            full: message.full,
            duration_minutes: message.duration_minutes as number | undefined,
            questions_answered: message.questions_answered as number | undefined,
            code_problems_attempted: message.code_problems_attempted as number | undefined,
          };
          options.setFeedback(payload);
          persistFeedback(options.sessionId, payload);
          toast.success("Interview completed!");
          break;
        }
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
