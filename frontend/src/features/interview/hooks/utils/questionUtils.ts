type QuestionPayload = {
  question?: unknown;
  phase?: string;
  spoken_text?: string;
};

export const normalizeQuestionPayload = (payload: QuestionPayload) => {
  const q = payload?.question;
  if (
    payload?.phase === "dsa" &&
    q &&
    typeof q === "object" &&
    (q as { question?: unknown }).question &&
    typeof (q as { question?: unknown }).question === "object" &&
    (q as { question?: { question?: unknown } }).question?.question
  ) {
    return (q as { question: unknown }).question ?? null;
  }
  return q ?? null;
};

export const extractSpokenText = (payload: QuestionPayload) => {
  if (typeof payload?.spoken_text === "string") return payload.spoken_text;

  const q = payload?.question;
  if (typeof q === "string") return q;
  if (q && typeof q === "object") {
    const nested = (q as { question?: unknown }).question;
    if (typeof nested === "string") return nested;
    if (nested && typeof nested === "object") {
      const nestedQuestion = (nested as { question?: unknown }).question;
      if (typeof nestedQuestion === "string") return nestedQuestion;
    }
  }
  return "";
};
