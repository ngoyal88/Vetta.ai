import { useEffect, useState } from "react";
import {
  applySessionLogEvent,
  type SessionLogTurn,
} from "features/interview/session/sessionLogTurns";

/**
 * Builds chronological Agent/You bubbles from LiveKit adapter text streams.
 */
export function useSessionLogTurns(opts: {
  aiFullText: string;
  aiSpeaking: boolean;
  transcriptFinal: string;
  transcriptInterim: string;
}): SessionLogTurn[] {
  const [turns, setTurns] = useState<SessionLogTurn[]>([]);

  useEffect(() => {
    const text = (opts.aiFullText || "").trim();
    if (!text) return;
    setTurns((prev) =>
      applySessionLogEvent(prev, {
        type: "ai_text",
        text,
        streaming: opts.aiSpeaking,
      }),
    );
  }, [opts.aiFullText, opts.aiSpeaking]);

  useEffect(() => {
    const final = (opts.transcriptFinal || "").trim();
    const interim = (opts.transcriptInterim || "").trim();
    const live = [final, interim].filter(Boolean).join(" ").trim();

    if (live) {
      setTurns((prev) =>
        applySessionLogEvent(prev, {
          type: "you_text",
          text: live,
          streaming: true,
        }),
      );
      return;
    }

    setTurns((prev) =>
      applySessionLogEvent(prev, { type: "you_text", text: "", streaming: false }),
    );
  }, [opts.transcriptFinal, opts.transcriptInterim]);

  return turns;
}
