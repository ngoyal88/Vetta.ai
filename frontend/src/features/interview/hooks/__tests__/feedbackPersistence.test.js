import { loadFeedback, persistFeedback } from "../utils/feedbackPersistence";

const sessionId = "session-123";

beforeEach(() => {
  sessionStorage.clear();
});

describe("feedbackPersistence", () => {
  it("persists and loads feedback", () => {
    const payload = { feedback: "Nice work", duration_minutes: 12 };
    expect(persistFeedback(sessionId, payload)).toBe(true);
    expect(loadFeedback(sessionId)).toEqual(payload);
  });

  it("returns null when missing", () => {
    expect(loadFeedback("missing")).toBeNull();
  });
});
