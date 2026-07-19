export const MIC_PHRASE_PROMPT = "My microphone is ready for the interview.";

/** Minimum token overlap on expected tokens to count as a match. */
const PHRASE_MATCH_TOKEN_RATIO = 0.7;

export function normalizeTranscript(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function phraseMatches(
  heard: string,
  expected: string = MIC_PHRASE_PROMPT,
  minRatio: number = PHRASE_MATCH_TOKEN_RATIO,
): boolean {
  const a = normalizeTranscript(heard);
  const b = normalizeTranscript(expected);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;

  const heardTokens = new Set(a.split(" ").filter(Boolean));
  const expectedTokens = b.split(" ").filter(Boolean);
  if (expectedTokens.length === 0) return false;

  let hit = 0;
  for (const t of expectedTokens) {
    if (heardTokens.has(t)) hit += 1;
  }
  return hit / expectedTokens.length >= minRatio;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  abort: () => void;
};

export type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
