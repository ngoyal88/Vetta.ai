const getTextEncoder = () => (typeof TextEncoder !== "undefined" ? new TextEncoder() : null);
const getTextDecoder = () => (typeof TextDecoder !== "undefined" ? new TextDecoder() : null);

const encodeUtf8 = (text: string) => {
  const encoder = getTextEncoder();
  if (encoder) return encoder.encode(text);

  const encoded = unescape(encodeURIComponent(text));
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i += 1) {
    bytes[i] = encoded.charCodeAt(i);
  }
  return bytes;
};

const decodeUtf8 = (payload: ArrayBuffer | Uint8Array) => {
  const decoder = getTextDecoder();
  if (decoder) return decoder.decode(payload);

  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  let encoded = "";
  for (let i = 0; i < bytes.length; i += 1) {
    encoded += String.fromCharCode(bytes[i]);
  }
  return decodeURIComponent(escape(encoded));
};

const safeParseJson = (text: string) => {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, error } as const;
  }
};

export const encodeJsonMessage = (message: unknown) => {
  return encodeUtf8(JSON.stringify(message));
};

export const decodeJsonMessage = (payload: string | ArrayBuffer | Uint8Array) => {
  const text = typeof payload === "string" ? payload : decodeUtf8(payload);
  const parsed = safeParseJson(text);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error } as const;
  }
  return { ok: true, message: parsed.value } as const;
};
