import { isSilentStatus, isSpeakingStatus, normalizeStatus } from "../utils/statusMapping";

describe("statusMapping", () => {
  it("preserves thinking status when speaking arrives", () => {
    expect(normalizeStatus("thinking", "speaking")).toBe("thinking");
  });

  it("detects speaking and silent statuses", () => {
    expect(isSpeakingStatus("speaking")).toBe(true);
    expect(isSilentStatus("listening")).toBe(true);
  });
});
