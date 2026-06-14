import { extractSpokenText, normalizeQuestionPayload } from "../utils/questionUtils";

describe("questionUtils", () => {
  it("normalizes nested DSA question payload", () => {
    const payload = {
      phase: "dsa",
      question: { question: { question: "Nested question" } },
    };
    expect(normalizeQuestionPayload(payload)).toEqual({ question: "Nested question" });
  });

  it("returns direct question when not nested", () => {
    const payload = { phase: "behavioral", question: "Tell me about yourself" };
    expect(normalizeQuestionPayload(payload)).toBe("Tell me about yourself");
  });

  it("extracts spoken text with fallback", () => {
    expect(extractSpokenText({ spoken_text: "Spoken" })).toBe("Spoken");
    expect(extractSpokenText({ question: "Q1" })).toBe("Q1");
  });
});
