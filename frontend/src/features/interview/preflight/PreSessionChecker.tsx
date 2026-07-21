import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Lock, Mic, Play, Video, Wifi, XCircle } from "lucide-react";
import { Room } from "livekit-client";
import { setSkipPrecheck } from "features/interview/preflight/precheckStorage";
import {
  getSpeechRecognitionCtor,
  MIC_PHRASE_PROMPT,
  phraseMatches,
  type SpeechRecognitionLike,
} from "features/interview/preflight/micPhraseCheck";
import { useLocalCameraPreview } from "features/interview/preflight/useLocalCameraPreview";
import { api } from "shared/services/api";
import "./preflight.css";

const BROWSER_REQUIREMENTS = {
  audioWorklet: !!(typeof window !== "undefined" && window.AudioWorkletNode),
  getUserMedia: !!(navigator.mediaDevices?.getUserMedia),
  webSocket: typeof WebSocket !== "undefined",
};

const WAVE_BAR_COUNT = 10;
/** ~7s at 60fps — enough for the full prompt sentence. */
const MIC_LISTEN_FRAMES = 420;
const MIC_RMS_THRESHOLD = 0.008;

type CheckStateValue = "pending" | "running" | "passed" | "failed" | "warning";
type SectionId = "audio" | "network" | "camera";

type ErrorMessage = {
  title: string;
  body: string;
  fix?: string | null;
  source: "mic" | "speaker";
};

type PreSessionCheckerProps = {
  sessionId: string;
  onAllPassed?: () => void;
  onCancel?: () => void;
  getAuthToken?: () => Promise<string | null | undefined>;
};

type BadgeProps = {
  state: CheckStateValue | "live" | "denied" | "requesting";
  label: string;
  tone?: "ok" | "warn" | "bad" | "neutral" | "info";
};

function StatusBadge({ state, label, tone = "neutral" }: BadgeProps) {
  const toneClass =
    tone === "ok"
      ? "bg-[var(--emerald-dim)] text-[var(--color-tertiary)] border-[var(--emerald-border)]"
      : tone === "warn"
        ? "bg-[rgba(232,169,65,0.12)] text-[var(--color-warning)] border-[rgba(232,169,65,0.35)]"
        : tone === "bad"
          ? "bg-[rgba(255,180,171,0.12)] text-[var(--color-error)] border-[rgba(255,180,171,0.35)]"
          : tone === "info"
            ? "bg-[rgba(79,219,200,0.12)] text-[var(--color-secondary)] border-[rgba(79,219,200,0.35)]"
            : "bg-[var(--color-surface-container)]/50 text-[var(--color-on-surface-variant)] border-white/10";

  const showPulse = state === "passed" || state === "live" || state === "warning";
  const pulseColor =
    tone === "ok"
      ? "bg-[var(--color-tertiary)]"
      : tone === "info"
        ? "bg-[var(--color-secondary)]"
        : tone === "warn"
          ? "bg-[var(--color-warning)]"
          : "bg-[var(--color-on-surface-variant)]";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold leading-4 tracking-[0.02em] ${toneClass}`}
    >
      {showPulse ? (
        <span className={`h-2 w-2 rounded-full ${pulseColor} preflight-pulse-dot`} aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

function WaveformBars({ level, active }: { level: number; active: boolean }) {
  return (
    <div
      className="flex h-12 w-full items-center justify-center gap-1 rounded-lg border border-white/5 bg-[var(--color-surface-container)]/40 px-3"
      aria-hidden
    >
      {Array.from({ length: WAVE_BAR_COUNT }, (_, i) => {
        const phase = 0.25 + Math.abs(Math.sin((i + 1) * 0.7)) * 0.75;
        const liveH = Math.max(0.12, Math.min(1, level * 10 * phase));
        return (
          <div
            key={i}
            className={`preflight-wave-bar w-1.5 rounded-full bg-primary/80 ${
              active ? "" : "preflight-wave-bar--idle"
            }`}
            style={
              active
                ? { height: `${liveH * 100}%` }
                : { height: `${phase * 100}%`, animationDelay: `${(i + 1) * 0.1}s` }
            }
          />
        );
      })}
    </div>
  );
}

function InlineAlert({
  tone,
  title,
  body,
  fix,
  action,
}: {
  tone: "error" | "warn";
  title: string;
  body: string;
  fix?: string | null;
  action?: ReactNode;
}) {
  const box =
    tone === "error"
      ? "border-[rgba(255,180,171,0.3)] bg-[rgba(255,180,171,0.1)] text-[var(--color-error)]"
      : "border-[rgba(232,169,65,0.3)] bg-[rgba(232,169,65,0.1)] text-[var(--color-warning)]";

  return (
    <div className={`rounded-lg border p-3 ${box}`}>
      <p className="text-[12px] font-medium">{title}</p>
      <p className="mt-1 text-[12px] opacity-80">{body}</p>
      {fix ? <p className="mt-2 text-[12px] text-[var(--color-outline)]">{fix}</p> : null}
      {action}
    </div>
  );
}

function CheckSection({
  id,
  icon,
  iconClassName,
  title,
  subtitle,
  badge,
  expanded,
  children,
}: {
  id: SectionId;
  icon: ReactNode;
  iconClassName: string;
  title: string;
  subtitle?: string;
  badge: BadgeProps;
  expanded: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`preflight-${id}`}
      className={`preflight-section ${expanded ? "preflight-section--active" : "preflight-section--done"}`}
      aria-expanded={expanded}
    >
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div className={`flex min-w-0 items-center gap-3 ${iconClassName}`}>
          <span className="shrink-0" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-[20px] font-semibold leading-7 tracking-[-0.01em] text-[var(--color-on-surface)] md:text-[24px] md:leading-8">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[12px] leading-4 text-[var(--color-outline)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge {...badge} />
          <ChevronDown
            className={`h-4 w-4 text-[var(--color-outline)] transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </div>
      </div>

      <div className={`preflight-section__body ${expanded ? "preflight-section__body--open" : ""}`}>
        <div className="preflight-section__body-inner">
          <div className="border-t border-white/5 px-6 pb-6 pt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

function micStatusFrom(check: {
  mic_permission: CheckStateValue;
  mic_signal: CheckStateValue;
}): CheckStateValue {
  const { mic_permission: perm, mic_signal: signal } = check;
  if (perm === "failed" || perm === "running" || perm === "pending") return perm;
  if (perm === "passed") {
    if (signal === "running" || signal === "failed" || signal === "passed") return signal;
  }
  return "pending";
}

function audioStatusFrom(
  micStatus: CheckStateValue,
  speakerStatus: CheckStateValue,
  confirmingSpeaker: boolean,
): CheckStateValue {
  if (micStatus === "failed" || speakerStatus === "failed") return "failed";
  if (micStatus === "running" || speakerStatus === "running" || confirmingSpeaker) return "running";
  if (micStatus === "passed" && (speakerStatus === "passed" || speakerStatus === "warning")) {
    return speakerStatus === "warning" ? "warning" : "passed";
  }
  return "pending";
}

export function PreSessionChecker({
  sessionId,
  onAllPassed,
  onCancel,
  getAuthToken,
}: PreSessionCheckerProps) {
  const [checkState, setCheckState] = useState({
    mic_permission: "pending" as CheckStateValue,
    mic_signal: "pending" as CheckStateValue,
    speaker: "pending" as CheckStateValue,
    connection: "pending" as CheckStateValue,
  });
  const [activeSection, setActiveSection] = useState<SectionId>("audio");
  const [errorMessage, setErrorMessage] = useState<ErrorMessage | null>(null);
  const [connectionWarning, setConnectionWarning] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [showAudioMeter, setShowAudioMeter] = useState(false);
  const [audioMeterLevel, setAudioMeterLevel] = useState(0);
  const [phraseHeard, setPhraseHeard] = useState("");
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [showSpeakerConfirm, setShowSpeakerConfirm] = useState(false);
  const [allChecksDone, setAllChecksDone] = useState(false);
  const [connectionLatencyMs, setConnectionLatencyMs] = useState<number | null>(null);
  const lifecycleGenRef = useRef(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micListenGenRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const micAnalyserCtxRef = useRef<AudioContext | null>(null);
  const toneCtxRef = useRef<AudioContext | null>(null);
  const toneOscRef = useRef<OscillatorNode | null>(null);
  const toneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomRef = useRef<Room | null>(null);
  const healthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const camera = useLocalCameraPreview(false);

  const setCheckStateKey = (key: keyof typeof checkState, value: CheckStateValue) => {
    setCheckState((prev) => ({ ...prev, [key]: value }));
  };

  const isLifecycleAlive = (gen: number) => gen === lifecycleGenRef.current;

  const stopTone = () => {
    if (toneTimerRef.current != null) {
      clearTimeout(toneTimerRef.current);
      toneTimerRef.current = null;
    }
    try {
      toneOscRef.current?.stop();
    } catch {
      // already stopped
    }
    toneOscRef.current = null;
    const ctx = toneCtxRef.current;
    toneCtxRef.current = null;
    if (ctx) void ctx.close().catch(() => {});
  };

  const abortMicListen = () => {
    micListenGenRef.current += 1;
    try {
      recognitionRef.current?.abort();
    } catch {
      // already stopped
    }
    recognitionRef.current = null;
    const analyserCtx = micAnalyserCtxRef.current;
    micAnalyserCtxRef.current = null;
    if (analyserCtx) void analyserCtx.close().catch(() => {});
  };

  const teardownPreflight = () => {
    lifecycleGenRef.current += 1;
    abortMicListen();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    stopTone();
    if (healthTimeoutRef.current != null) {
      clearTimeout(healthTimeoutRef.current);
      healthTimeoutRef.current = null;
    }
    if (connectTimeoutRef.current != null) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    const room = roomRef.current;
    roomRef.current = null;
    try {
      room?.disconnect();
    } catch {
      // ignore
    }
    camera.stop();
  };

  const checkMicPermission = async () => {
    const gen = lifecycleGenRef.current;
    setActiveSection("audio");
    setCheckStateKey("mic_permission", "running");
    setErrorMessage(null);
    setConnectionError(null);
    setAllChecksDone(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isLifecycleAlive(gen)) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = stream;
      setCheckStateKey("mic_permission", "passed");
      void checkMicSignal(stream);
    } catch (err) {
      if (!isLifecycleAlive(gen)) return;
      const name = err instanceof DOMException ? err.name : "";
      setCheckStateKey("mic_permission", "failed");
      if (name === "NotAllowedError") {
        setErrorMessage({
          title: "Microphone access denied",
          body: "Click the mic icon in your browser address bar → Allow → then refresh this page.",
          fix: "Chrome: Settings → Privacy and security → Site settings → Microphone → Allow vetta.ai",
          source: "mic",
        });
      } else if (name === "NotFoundError") {
        setErrorMessage({
          title: "No microphone found",
          body: "Plug in a headset or check your system audio settings.",
          fix: null,
          source: "mic",
        });
      } else if (name === "NotReadableError") {
        setErrorMessage({
          title: "Microphone is in use by another app",
          body: "Close Zoom, Discord, Google Meet, or any other app using your mic, then try again.",
          fix: null,
          source: "mic",
        });
      } else {
        const detail = err instanceof Error ? err.message : "unknown error";
        setErrorMessage({
          title: "Microphone error",
          body: `Could not access microphone: ${detail}`,
          fix: null,
          source: "mic",
        });
      }
      setAllChecksDone(true);
    }
  };

  const checkMicSignal = async (stream: MediaStream) => {
    abortMicListen();
    const listenGen = micListenGenRef.current;
    const lifeGen = lifecycleGenRef.current;
    setActiveSection("audio");
    setCheckStateKey("mic_signal", "running");
    setShowAudioMeter(true);
    setPhraseHeard("");
    setErrorMessage(null);
    setAllChecksDone(false);

    const audioContext = new AudioContext({ sampleRate: 16000 });
    micAnalyserCtxRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let maxRms = 0;
    let frameCount = 0;
    let settled = false;

    const settle = (passed: boolean) => {
      if (
        settled ||
        listenGen !== micListenGenRef.current ||
        !isLifecycleAlive(lifeGen)
      ) {
        return;
      }
      settled = true;
      try {
        recognitionRef.current?.abort();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
      if (micAnalyserCtxRef.current === audioContext) {
        micAnalyserCtxRef.current = null;
      }
      void audioContext.close().catch(() => {});
      setShowAudioMeter(false);
      setPhraseHeard("");

      if (passed) {
        setCheckStateKey("mic_signal", "passed");
        void checkSpeaker();
        return;
      }

      setCheckStateKey("mic_signal", "failed");
      setErrorMessage({
        title: "Microphone not picking up sound",
        body: `We could not hear the line. Say: “${MIC_PHRASE_PROMPT}” at a normal volume, confirm the mic is not muted, and try a different input if needed.`,
        fix: null,
        source: "mic",
      });
      setShowDeviceSelector(true);
      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        if (!isLifecycleAlive(lifeGen)) return;
        setAudioInputDevices(devices.filter((d) => d.kind === "audioinput"));
      });
      setAllChecksDone(true);
    };

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (RecognitionCtor) {
      const recognition = new RecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        if (
          settled ||
          listenGen !== micListenGenRef.current ||
          !isLifecycleAlive(lifeGen)
        ) {
          return;
        }
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript ?? "";
        }
        const trimmed = transcript.trim();
        if (trimmed) setPhraseHeard(trimmed);
        if (phraseMatches(trimmed)) settle(true);
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
      }
    }

    const measure = () => {
      if (
        settled ||
        listenGen !== micListenGenRef.current ||
        !isLifecycleAlive(lifeGen)
      ) {
        return;
      }

      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      maxRms = Math.max(maxRms, rms);
      setAudioMeterLevel(rms);
      frameCount++;

      if (frameCount < MIC_LISTEN_FRAMES) {
        requestAnimationFrame(measure);
        return;
      }

      settle(maxRms >= MIC_RMS_THRESHOLD);
    };
    requestAnimationFrame(measure);
  };

  const switchDevice = async (deviceId: string) => {
    const lifeGen = lifecycleGenRef.current;
    abortMicListen();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
    });
    if (!isLifecycleAlive(lifeGen)) {
      newStream.getTracks().forEach((t) => t.stop());
      return;
    }
    micStreamRef.current = newStream;
    setCheckStateKey("mic_signal", "pending");
    setErrorMessage(null);
    setShowDeviceSelector(false);
    setAllChecksDone(false);
    void checkMicSignal(newStream);
  };

  const playTestTone = async () => {
    stopTone();
    const gen = lifecycleGenRef.current;
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.15;
    toneCtxRef.current = audioContext;
    toneOscRef.current = oscillator;
    oscillator.start();
    await new Promise<void>((resolve) => {
      toneTimerRef.current = setTimeout(() => {
        toneTimerRef.current = null;
        resolve();
      }, 600);
    });
    if (!isLifecycleAlive(gen)) return;
    stopTone();
  };

  const checkSpeaker = async () => {
    const gen = lifecycleGenRef.current;
    setActiveSection("audio");
    setCheckStateKey("speaker", "running");
    setErrorMessage(null);
    setAllChecksDone(false);
    await playTestTone();
    if (!isLifecycleAlive(gen)) return;
    setShowSpeakerConfirm(true);
  };

  const advanceAfterSpeaker = (result: "passed" | "warning") => {
    if (!isLifecycleAlive(lifecycleGenRef.current)) return;
    setShowSpeakerConfirm(false);
    setCheckStateKey("speaker", result);
    if (result === "warning") {
      setErrorMessage({
        title: "Audio output not confirmed",
        body: "Check system volume, headphones, and that the browser tab is not muted.",
        fix: "Windows: Volume Mixer. Mac: menu-bar speaker icon.",
        source: "speaker",
      });
    } else {
      setErrorMessage(null);
    }
    abortMicListen();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    void checkConnection();
  };

  const checkConnection = async () => {
    const gen = lifecycleGenRef.current;
    setActiveSection("network");
    setCheckStateKey("connection", "running");
    setConnectionWarning(null);
    setConnectionError(null);
    setConnectionLatencyMs(null);
    setAllChecksDone(false);
    const start = Date.now();
    const healthAbort = new AbortController();
    healthTimeoutRef.current = setTimeout(() => healthAbort.abort(), 5000);
    try {
      await api.getLivekitHealth(null, healthAbort.signal);
      if (!isLifecycleAlive(gen)) return;

      const token = (await getAuthToken?.()) || null;
      if (!isLifecycleAlive(gen)) return;
      if (!token) throw new Error("Authentication token unavailable");

      const tokenData = await api.createLivekitToken(sessionId);
      if (!isLifecycleAlive(gen)) return;
      const lkToken = tokenData?.token;
      const lkUrl = (tokenData?.url || "").trim();
      if (!lkToken || !lkUrl) {
        throw new Error("LiveKit token response missing url/token");
      }

      const room = new Room();
      roomRef.current = room;
      try {
        const connectTimeoutMs = 10000;
        const connectPromise = room.connect(lkUrl, lkToken);
        const timeoutPromise = new Promise<never>((_, reject) => {
          connectTimeoutRef.current = setTimeout(() => {
            connectTimeoutRef.current = null;
            reject(new Error("LiveKit connection timed out"));
          }, connectTimeoutMs);
        });
        await Promise.race([connectPromise, timeoutPromise]);
      } finally {
        if (connectTimeoutRef.current != null) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        try {
          room.disconnect();
        } catch {
          // ignore
        }
        if (roomRef.current === room) roomRef.current = null;
      }

      if (!isLifecycleAlive(gen)) return;

      const latency = Date.now() - start;
      setConnectionLatencyMs(latency);
      if (latency > 2000) {
        setCheckStateKey("connection", "warning");
        setConnectionWarning(
          `Your connection is slow (${latency}ms). The interview may experience delays. Try a wired connection or disable VPN.`,
        );
      } else {
        setCheckStateKey("connection", "passed");
      }
      void runCameraStep();
    } catch (err) {
      if (!isLifecycleAlive(gen)) return;
      const name = err instanceof Error ? err.name : "";
      setCheckStateKey("connection", "failed");
      if (name === "TimeoutError" || name === "AbortError") {
        setConnectionError({
          title: "Connection check failed",
          body: "We could not reach the interview servers from this network. You can try the WebSocket fallback or switch networks and retry.",
        });
      } else {
        setConnectionError({
          title: "LiveKit connection failed",
          body:
            (err instanceof Error && err.message) ||
            "We could not establish a LiveKit connection. You can try the WebSocket fallback to continue.",
        });
      }
      setAllChecksDone(true);
    } finally {
      if (healthTimeoutRef.current != null) {
        clearTimeout(healthTimeoutRef.current);
        healthTimeoutRef.current = null;
      }
    }
  };

  const runCameraStep = async () => {
    const gen = lifecycleGenRef.current;
    setActiveSection("camera");
    setAllChecksDone(false);
    await camera.start();
    if (!isLifecycleAlive(gen)) return;
    // Preview-only — denial never blocks Start Interview.
    setAllChecksDone(true);
  };

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    void checkMicPermission();
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      teardownPreflight();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const micStatus = micStatusFrom(checkState);
  const speakerStatus = checkState.speaker;
  const connectionStatus = checkState.connection;
  const audioStatus = audioStatusFrom(micStatus, speakerStatus, showSpeakerConfirm);
  const onSpeakerStep = micStatus === "passed";

  const micError = errorMessage?.source === "mic" ? errorMessage : null;
  const speakerError = errorMessage?.source === "speaker" ? errorMessage : null;
  const hasBlockingFailure = micStatus === "failed" || connectionStatus === "failed";

  const audioBadge: BadgeProps =
    audioStatus === "passed"
      ? { label: "Optimal", tone: "ok", state: "passed" }
      : audioStatus === "warning"
        ? { label: "Speaker unverified", tone: "warn", state: "warning" }
        : audioStatus === "failed"
          ? { label: "Needs attention", tone: "bad", state: "failed" }
          : audioStatus === "running"
            ? { label: "Checking", tone: "info", state: "running" }
            : { label: "Waiting", tone: "neutral", state: "pending" };

  const networkBadge: BadgeProps =
    connectionStatus === "passed"
      ? { label: "Connected", tone: "info", state: "passed" }
      : connectionStatus === "warning"
        ? { label: "Slow link", tone: "warn", state: "warning" }
        : connectionStatus === "failed"
          ? { label: "Offline", tone: "bad", state: "failed" }
          : connectionStatus === "running"
            ? { label: "Probing", tone: "neutral", state: "running" }
            : { label: "Queued", tone: "neutral", state: "pending" };

  const cameraBadge: BadgeProps =
    camera.status === "live"
      ? { label: "Live preview", tone: "ok", state: "live" }
      : camera.status === "requesting"
        ? { label: "Requesting", tone: "neutral", state: "requesting" }
        : camera.status === "denied"
          ? { label: "Permission needed", tone: "warn", state: "denied" }
          : camera.status === "unavailable" || camera.status === "error"
            ? { label: "Unavailable", tone: "neutral", state: "denied" }
            : { label: "Queued", tone: "neutral", state: "pending" };

  const handleSkipPrecheck = () => {
    setSkipPrecheck(true);
    teardownPreflight();
    onAllPassed?.();
  };

  const handleCancel = () => {
    teardownPreflight();
    onCancel?.();
  };

  const routeToWebSocket = () => {
    teardownPreflight();
    try {
      sessionStorage.setItem("force_ws", "1");
      window.location.href = `/interview/${sessionId}?transport=ws`;
    } catch {
      window.location.href = `/interview/${sessionId}?transport=ws`;
    }
  };

  const primaryLabel = !allChecksDone
    ? "Running checks…"
    : hasBlockingFailure
      ? "Resolve issues to continue"
      : "Start interview";

  const handleStart = () => {
    teardownPreflight();
    onAllPassed?.();
  };

  const audioSubtitle =
    audioStatus === "passed"
      ? "Microphone and speakers ready"
      : audioStatus === "warning"
        ? "Mic ready · speaker unverified"
        : audioStatus === "failed" || micStatus === "failed"
          ? "Microphone needs attention"
          : onSpeakerStep
            ? "Did you hear the test tone?"
            : showAudioMeter || checkState.mic_signal === "running"
              ? "Say the line aloud"
              : "Checking microphone";

  const networkSubtitle =
    activeSection === "network"
      ? "Probing interview servers"
      : connectionStatus === "pending"
        ? "Waiting for audio to finish"
        : connectionStatus === "failed"
          ? "Could not reach interview servers"
          : "Link checked";

  const cameraSubtitle =
    activeSection === "camera"
      ? "Local mirrored preview · never uploaded"
      : camera.status === "idle"
        ? "Waiting for network to finish"
        : "Local preview only";

  const linkLabel =
    connectionStatus === "passed" || connectionStatus === "warning"
      ? "Reachable"
      : connectionStatus === "failed"
        ? "Unreachable"
        : connectionStatus === "running"
          ? "Checking…"
          : "Pending";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[var(--color-background)] p-4 md:p-8">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(173,198,255,0.08),transparent_55%)]"
        aria-hidden
      />

      <div className="preflight-panel relative my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-xl">
        <div className="h-1 w-full bg-gradient-to-r from-secondary via-primary to-secondary" />

        <header className="border-b border-white/5 px-8 py-6 text-center">
          <h2 className="text-[24px] font-bold leading-8 tracking-[-0.01em] text-[var(--color-on-surface)] md:text-[32px] md:leading-10">
            Pre-Flight Diagnostic
          </h2>
          <p className="mt-2 text-[14px] leading-5 text-[var(--color-on-surface-variant)] md:text-[16px] md:leading-6">
            Checks run one at a time. Camera stays on this device only.
          </p>
        </header>

        <div className="flex flex-col gap-6 p-8">
          <CheckSection
            id="audio"
            icon={<Mic className="h-5 w-5" />}
            iconClassName="text-primary"
            title="Audio Synchronization"
            subtitle={audioSubtitle}
            badge={audioBadge}
            expanded={activeSection === "audio"}
          >
            <div className="flex flex-col gap-4">
              {!onSpeakerStep ? (
                <>
                  <p className="text-center text-[15px] font-semibold leading-6 text-[var(--color-on-surface)]">
                    “{MIC_PHRASE_PROMPT}”
                  </p>
                  <WaveformBars level={audioMeterLevel} active={showAudioMeter} />
                  <p className="text-center text-[12px] leading-4 text-[var(--color-outline)]">
                    {phraseHeard
                      ? `Heard: ${phraseHeard}`
                      : showAudioMeter
                        ? "Listening…"
                        : "Waiting for microphone…"}
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void playTestTone()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-5 py-3 text-[14px] font-semibold text-[var(--color-on-surface)] transition-colors hover:bg-white/5"
                  >
                    <Play className="h-4 w-4" aria-hidden />
                    Play test sound
                  </button>
                  {showSpeakerConfirm ? (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => advanceAfterSpeaker("passed")}
                        className="flex-1 rounded-lg border border-[var(--emerald-border)] bg-[var(--emerald-dim)] py-2.5 text-[12px] font-semibold text-[var(--color-tertiary)] transition-colors hover:bg-[rgba(78,222,163,0.2)]"
                      >
                        Yes, I heard it
                      </button>
                      <button
                        type="button"
                        onClick={() => advanceAfterSpeaker("warning")}
                        className="flex-1 rounded-lg border border-white/10 py-2.5 text-[12px] font-semibold text-[var(--color-on-surface-variant)] transition-colors hover:bg-white/5"
                      >
                        No, I did not
                      </button>
                    </div>
                  ) : null}
                </>
              )}

              {micError ? (
                <InlineAlert
                  tone="error"
                  title={micError.title}
                  body={micError.body}
                  fix={micError.fix}
                />
              ) : null}

              {speakerError ? (
                <InlineAlert
                  tone="warn"
                  title={speakerError.title}
                  body={speakerError.body}
                  fix={speakerError.fix}
                />
              ) : null}

              {showDeviceSelector && audioInputDevices.length > 0 ? (
                <div>
                  <p className="mb-1 text-[12px] text-[var(--color-outline)]">
                    Try a different microphone:
                  </p>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-[var(--color-surface-container)] px-3 py-2 text-sm text-[var(--color-on-surface)] focus:border-primary/50 focus:outline-none"
                    onChange={(e) => {
                      if (e.target.value) void switchDevice(e.target.value);
                    }}
                    defaultValue=""
                  >
                    <option value="">Select microphone…</option>
                    {audioInputDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </CheckSection>

          <CheckSection
            id="network"
            icon={<Wifi className="h-5 w-5" />}
            iconClassName="text-secondary"
            title="Network Telemetry"
            subtitle={networkSubtitle}
            badge={networkBadge}
            expanded={activeSection === "network"}
          >
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-white/5 bg-[var(--color-surface-container)]/50 p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                    Latency
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[40px] font-bold leading-[48px] tracking-[-0.02em] text-[var(--color-on-surface)] tabular-nums md:text-[48px] md:leading-[56px]">
                      {connectionLatencyMs != null ? connectionLatencyMs : "—"}
                    </span>
                    <span className="text-[14px] font-semibold text-[var(--color-tertiary)]">ms</span>
                  </div>
                </div>
                <div className="rounded-lg border border-white/5 bg-[var(--color-surface-container)]/50 p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                    Interview link
                  </span>
                  <div className="mt-2">
                    <span className="text-[18px] font-semibold leading-7 text-[var(--color-on-surface)]">
                      {linkLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-4 text-[var(--color-outline)]">
                    LiveKit health + short room connect probe.
                  </p>
                </div>
              </div>

              {connectionWarning ? (
                <InlineAlert tone="warn" title="Slow connection" body={connectionWarning} />
              ) : null}

              {connectionError ? (
                <InlineAlert
                  tone="error"
                  title={connectionError.title}
                  body={connectionError.body}
                  action={
                    <button
                      type="button"
                      onClick={routeToWebSocket}
                      className="mt-3 w-full rounded-lg bg-primary-container py-2 text-[12px] font-semibold text-on-primary transition-colors hover:bg-primary"
                    >
                      Try WebSocket fallback
                    </button>
                  }
                />
              ) : null}
            </div>
          </CheckSection>

          <CheckSection
            id="camera"
            icon={<Video className="h-5 w-5" />}
            iconClassName="text-[var(--color-outline)]"
            title="Visual Feed"
            subtitle={cameraSubtitle}
            badge={cameraBadge}
            expanded={activeSection === "camera"}
          >
            <div className="relative aspect-video max-h-56 w-full overflow-hidden rounded-lg border border-dashed border-white/20 bg-[var(--color-surface)]/30">
              {camera.isLive ? (
                <video
                  ref={camera.videoRef}
                  className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
                  playsInline
                  muted
                  autoPlay
                  aria-label="Local camera preview"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--color-on-surface-variant)]">
                  <Lock className="h-9 w-9 opacity-50" aria-hidden />
                  <p className="px-4 text-center text-[14px] font-semibold leading-5">
                    {camera.status === "requesting"
                      ? "Requesting camera permission…"
                      : camera.errorMessage || "Camera access requires permission."}
                  </p>
                  {camera.status !== "requesting" && camera.status !== "idle" ? (
                    <button
                      type="button"
                      onClick={() => void camera.start()}
                      className="mt-1 rounded-lg border border-white/10 px-4 py-2 text-[12px] font-semibold transition-colors hover:bg-white/5"
                    >
                      Enable camera
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </CheckSection>
        </div>

        <div className="flex flex-col gap-2 px-8 pb-8">
          <button
            type="button"
            onClick={handleStart}
            disabled={!allChecksDone || hasBlockingFailure}
            className={`w-full rounded-xl py-4 text-[18px] font-semibold leading-7 tracking-tight transition-colors md:text-[20px] ${
              allChecksDone && !hasBlockingFailure
                ? "bg-primary-container text-on-primary shadow-[0_0_15px_rgba(77,142,255,0.4)] hover:bg-primary"
                : "cursor-not-allowed border border-white/5 bg-[var(--color-surface-container)] text-[var(--color-outline)] opacity-50 shadow-none"
            }`}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={handleSkipPrecheck}
            className="w-full rounded-xl py-2.5 text-[12px] text-[var(--color-on-surface-variant)] transition-colors hover:border hover:border-white/10 hover:text-[var(--color-on-surface)]"
          >
            Skip pre-check, I know it works
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-full rounded-xl py-2.5 text-[14px] text-[var(--color-on-surface-variant)] transition-colors hover:border hover:border-white/10 hover:text-[var(--color-on-surface)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function PreSessionCheckerWithBrowserCheck(props: PreSessionCheckerProps) {
  const unsupported = Object.entries(BROWSER_REQUIREMENTS)
    .filter(([, supported]) => !supported)
    .map(([name]) => name);

  if (unsupported.length > 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--color-background)] p-4">
        <div className="preflight-panel w-full max-w-md rounded-2xl p-8 text-center">
          <XCircle className="mx-auto mb-4 h-12 w-12 text-[var(--color-error)]" />
          <h2 className="mb-2 text-lg font-semibold text-[var(--color-on-surface)]">
            Browser not supported
          </h2>
          <p className="mb-4 text-sm text-[var(--color-on-surface-variant)]">
            Vetta requires Chrome 90+ or Edge 90+ for voice interviews. Safari on iPhone is not yet
            supported.
          </p>
          <a
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-primary-container px-6 py-2 text-sm font-semibold text-on-primary"
          >
            Download Chrome
          </a>
        </div>
      </div>
    );
  }

  return <PreSessionChecker {...props} />;
}
