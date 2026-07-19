import { useCallback, useEffect, useRef, useState } from "react";

export type LocalCameraStatus =
  | "idle"
  | "requesting"
  | "live"
  | "denied"
  | "unavailable"
  | "error";

export function mapCameraError(err: unknown): {
  status: Exclude<LocalCameraStatus, "idle" | "requesting" | "live">;
  message: string;
} {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      status: "denied",
      message: "Allow camera access in the browser address bar, then try again.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      status: "unavailable",
      message: "No camera found. Plug one in if you want a self-view.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      status: "error",
      message: "Camera is in use by another app. Close it, then retry.",
    };
  }
  const detail = err instanceof Error ? err.message : "Could not open camera.";
  return { status: "error", message: detail };
}

/**
 * Local-only camera preview. Stream never leaves the browser.
 * ponytail: single front camera Ideal constraint; multi-cam picker is upgrade path.
 */
export function useLocalCameraPreview(autoStart = false) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generationRef = useRef(0);
  const [status, setStatus] = useState<LocalCameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    generationRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    // Plays without gesture when muted; ignore AbortError from rapid remount.
    void el.play().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      setErrorMessage("This browser cannot open a camera preview.");
      return;
    }

    generationRef.current += 1;
    const generation = generationRef.current;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    setStatus("requesting");
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 360 },
        },
      });

      if (generation !== generationRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      attachStream(stream);
      setStatus("live");
    } catch (err) {
      if (generation !== generationRef.current) return;
      streamRef.current = null;
      const mapped = mapCameraError(err);
      setStatus(mapped.status);
      setErrorMessage(mapped.message);
    }
  }, [attachStream]);

  // Re-attach if the video element remounts after permission grant.
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      void node.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (autoStart) void start();
    return stop;
  }, [autoStart, start, stop]);

  return {
    videoRef: setVideoRef,
    status,
    errorMessage,
    start,
    stop,
    isLive: status === "live",
  };
}
