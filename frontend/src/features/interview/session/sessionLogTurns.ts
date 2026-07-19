export type SessionLogRole = "agent" | "you";

export type SessionLogTurn = {
  id: string;
  role: SessionLogRole;
  text: string;
  at: number;
  streaming?: boolean;
};

export type SessionLogEvent =
  | { type: "ai_text"; text: string; streaming: boolean }
  | { type: "you_text"; text: string; streaming: boolean };

let turnSeq = 0;
const nextId = (role: SessionLogRole) => `${role}-${Date.now()}-${(turnSeq += 1)}`;

/** Pure reducer for Session Log bubbles. */
export function applySessionLogEvent(
  turns: SessionLogTurn[],
  event: SessionLogEvent,
): SessionLogTurn[] {
  const text = event.text.trim();
  if (!text && event.type === "you_text" && !event.streaming) {
    // Finalize last You turn when STT buffer clears.
    const last = turns[turns.length - 1];
    if (last?.role === "you" && last.streaming) {
      return [...turns.slice(0, -1), { ...last, streaming: false }];
    }
    return turns;
  }
  if (!text) return turns;

  const role: SessionLogRole = event.type === "ai_text" ? "agent" : "you";
  const last = turns[turns.length - 1];

  if (last?.role === role && (last.streaming || event.streaming)) {
    if (last.text === text && Boolean(last.streaming) === event.streaming) return turns;
    return [
      ...turns.slice(0, -1),
      { ...last, text, streaming: event.streaming, at: last.at },
    ];
  }

  if (last?.role === role && !last.streaming && !event.streaming && last.text === text) {
    return turns;
  }

  return [
    ...turns,
    {
      id: nextId(role),
      role,
      text,
      at: Date.now(),
      streaming: event.streaming,
    },
  ];
}

export function formatTurnClock(at: number): string {
  try {
    return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Compact relative label for DSA analysis stream. */
export function formatTurnRelative(at: number, now = Date.now()): string {
  const deltaSec = Math.max(0, Math.floor((now - at) / 1000));
  if (deltaSec < 45) return "Just now";
  const mins = Math.floor(deltaSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
