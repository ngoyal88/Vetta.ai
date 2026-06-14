import { decodeJsonMessage, encodeJsonMessage } from "../utils/messageCodec";

describe("messageCodec", () => {
  it("encodes and decodes JSON payloads", () => {
    const payload = { type: "ping", value: 1 };
    const encoded = encodeJsonMessage(payload);
    const decoded = decodeJsonMessage(encoded);
    expect(decoded.ok).toBe(true);
    expect(decoded.message).toEqual(payload);
  });

  it("returns error on invalid JSON", () => {
    const decoded = decodeJsonMessage("not-json");
    expect(decoded.ok).toBe(false);
  });
});
