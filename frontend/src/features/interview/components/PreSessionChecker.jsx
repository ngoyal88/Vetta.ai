import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Room } from "livekit-client";
import { setSkipPrecheck } from "features/interview/utils/precheckStorage";
import { api } from "shared/services/api";

const BROWSER_REQUIREMENTS = {
  audioWorklet: !!(typeof window !== "undefined" && window.AudioWorkletNode),
  getUserMedia: !!(navigator.mediaDevices?.getUserMedia),
  webSocket: typeof WebSocket !== "undefined",
};

const getStatusLabel = (state) => {
  if (state === "pending") return "Waiting";
  if (state === "running") return "Checking";
  if (state === "passed") return "Ready";
  if (state === "failed") return "Needs attention";
  if (state === "warning") return "Warning";
  return "Waiting";
};

export function PreSessionChecker({ sessionId, onAllPassed, onCancel, getAuthToken }) {
  const [checkState, setCheckState] = useState({
    mic_permission: "pending",
    mic_signal: "pending",
    speaker: "pending",
    connection: "pending",
  });
  const [errorMessage, setErrorMessage] = useState(null);
  const [connectionWarning, setConnectionWarning] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [showAudioMeter, setShowAudioMeter] = useState(false);
  const [audioMeterLevel, setAudioMeterLevel] = useState(0);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [showSpeakerConfirm, setShowSpeakerConfirm] = useState(false);
  const [allChecksDone, setAllChecksDone] = useState(false);
  const micStreamRef = useRef(null);

  const setCheckStateKey = (key, value) => {
    setCheckState((prev) => ({ ...prev, [key]: value }));
  };

  const checkMicPermission = async () => {
    setCheckStateKey("mic_permission", "running");
    setErrorMessage(null);
    setConnectionError(null);
    setAllChecksDone(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setCheckStateKey("mic_permission", "passed");
      checkMicSignal(stream);
    } catch (err) {
      setCheckStateKey("mic_permission", "failed");
      if (err.name === "NotAllowedError") {
        setErrorMessage({
          title: "Microphone access denied",
          body:
            "Click the camera/mic icon in your browser address bar -> Allow -> then refresh this page.",
          fix: "How to allow mic in Chrome: Settings -> Privacy -> Microphone -> Allow roundr.ai",
          source: "mic",
        });
      } else if (err.name === "NotFoundError") {
        setErrorMessage({
          title: "No microphone found",
          body: "Plug in a headset or check your system audio settings.",
          fix: null,
          source: "mic",
        });
      } else if (err.name === "NotReadableError") {
        setErrorMessage({
          title: "Microphone is in use by another app",
          body:
            "Close Zoom, Discord, Google Meet, or any other app using your mic, then try again.",
          fix: null,
          source: "mic",
        });
      } else {
        setErrorMessage({
          title: "Microphone error",
          body: `Could not access microphone: ${err.message}`,
          fix: null,
          source: "mic",
        });
      }
      setAllChecksDone(true);
    }
  };

  const checkMicSignal = async (stream) => {
    setCheckStateKey("mic_signal", "running");
    setShowAudioMeter(true);
    setErrorMessage(null);
    setAllChecksDone(false);

    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let maxRms = 0;
    let frameCount = 0;
    const TOTAL_FRAMES = 180;

    const measure = () => {
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

      if (frameCount < TOTAL_FRAMES) {
        requestAnimationFrame(measure);
      } else {
        audioContext.close();
        setShowAudioMeter(false);
        if (maxRms < 0.008) {
          setCheckStateKey("mic_signal", "failed");
          setErrorMessage({
            title: "Microphone not picking up sound",
            body:
              "We detected your mic but no usable signal. Speak at a normal volume, confirm the mic is not muted in system settings, and try a different input if needed. Silent sessions may auto-end after 3 minutes.",
            fix: null,
            source: "mic",
          });
          setShowDeviceSelector(true);
          navigator.mediaDevices.enumerateDevices().then((devices) => {
            setAudioInputDevices(devices.filter((d) => d.kind === "audioinput"));
          });
          setAllChecksDone(true);
        } else {
          setCheckStateKey("mic_signal", "passed");
          checkSpeaker();
        }
      }
    };
    requestAnimationFrame(measure);
  };

  const switchDevice = async (deviceId) => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
    });
    micStreamRef.current = newStream;
    setCheckStateKey("mic_signal", "pending");
    setErrorMessage(null);
    setShowDeviceSelector(false);
    checkMicSignal(newStream);
  };

  const checkSpeaker = async () => {
    setCheckStateKey("speaker", "running");
    setErrorMessage(null);
    setAllChecksDone(false);
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.15;
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
      setShowSpeakerConfirm(true);
    }, 600);
  };

  const checkConnection = async () => {
    setCheckStateKey("connection", "running");
    setConnectionWarning(null);
    setConnectionError(null);
    setAllChecksDone(false);
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      await api.getLivekitHealth(null, controller.signal);

      const token = (await getAuthToken?.()) || null;
      if (!token) throw new Error("Authentication token unavailable");

      const tokenData = await api.createLivekitToken(sessionId);
      const lkToken = tokenData?.token;
      const lkUrl = (tokenData?.url || "").trim();
      if (!lkToken || !lkUrl) {
        throw new Error("LiveKit token response missing url/token");
      }

      const room = new Room();
      try {
        const connectTimeoutMs = 10000;
        const connectPromise = room.connect(lkUrl, lkToken);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("LiveKit connection timed out")), connectTimeoutMs);
        });
        await Promise.race([connectPromise, timeoutPromise]);
      } finally {
        room.disconnect();
      }

      clearTimeout(timeoutId);
      const latency = Date.now() - start;
      if (latency > 2000) {
        setCheckStateKey("connection", "warning");
        setConnectionWarning(
          `Your connection is slow (${latency}ms). The interview may experience delays. Try switching to a wired connection or disabling VPN.`
        );
      } else {
        setCheckStateKey("connection", "passed");
      }
      setAllChecksDone(true);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        setCheckStateKey("connection", "failed");
        setConnectionError({
          title: "Connection check failed",
          body:
            "We could not reach the interview servers from this network. You can try the WebSocket fallback or switch networks and retry.",
        });
      } else {
        setCheckStateKey("connection", "failed");
        setConnectionError({
          title: "LiveKit connection failed",
          body:
            err?.message ||
            "We could not establish a LiveKit connection. You can try the WebSocket fallback to continue.",
        });
      }
      setAllChecksDone(true);
    }
  };

  useEffect(() => {
    checkMicPermission();
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getMicStatus = () => {
    if (checkState.mic_permission === "failed") return "failed";
    if (checkState.mic_permission === "running") return "running";
    if (checkState.mic_permission === "pending") return "pending";
    if (checkState.mic_permission === "passed") {
      if (checkState.mic_signal === "running") return "running";
      if (checkState.mic_signal === "failed") return "failed";
      if (checkState.mic_signal === "passed") return "passed";
      return "pending";
    }
    return "pending";
  };

  const micStatus = getMicStatus();
  const speakerStatus = checkState.speaker;
  const connectionStatus = checkState.connection;

  const micError = errorMessage?.source === "mic" ? errorMessage : null;
  const speakerError = errorMessage?.source === "speaker" ? errorMessage : null;

  const hasBlockingFailure = micStatus === "failed" || connectionStatus === "failed";

  const renderCheckIcon = (state) => {
    if (state === "pending")
      return (
        <div className="w-5 h-5 rounded-full border border-zinc-600 shrink-0" />
      );
    if (state === "running")
      return (
        <div className="w-5 h-5 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin shrink-0" />
      );
    if (state === "passed")
      return <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />;
    if (state === "failed")
      return <XCircle className="w-5 h-5 text-red-400 shrink-0" />;
    if (state === "warning")
      return <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />;
    return (
      <div className="w-5 h-5 rounded-full border border-zinc-600 shrink-0" />
    );
  };

  const micHint = () => {
    if (micStatus === "running") return "Listening for input. Speak a few words.";
    if (micStatus === "passed") return "Microphone access and input look good.";
    if (micStatus === "failed") return "We could not hear your microphone.";
    return "We will check mic access and input level.";
  };

  const speakerHint = () => {
    if (speakerStatus === "running") return "Playing a short beep.";
    if (speakerStatus === "passed") return "Audio output looks good.";
    if (speakerStatus === "warning") return "We did not confirm speaker output.";
    return "We will play a short beep to confirm audio output.";
  };

  const connectionHint = () => {
    if (connectionStatus === "running") return "Checking reachability to the interview servers.";
    if (connectionStatus === "passed") return "Connection looks stable.";
    if (connectionStatus === "warning") return "Connection is usable but a bit slow.";
    if (connectionStatus === "failed") return "We could not reach the live interview servers.";
    return "We will verify that the interview servers are reachable.";
  };

  const handleSkipPrecheck = () => {
    setSkipPrecheck(true);
    onAllPassed?.();
  };

  const routeToWebSocket = () => {
    try {
      sessionStorage.setItem("force_ws", "1");
      window.location.href = `/interview/${sessionId}?transport=ws`;
    } catch (err) {
      window.location.href = `/interview/${sessionId}?transport=ws`;
    }
  };

  const primaryLabel = !allChecksDone
    ? "Running checks..."
    : hasBlockingFailure
      ? "Resolve issues to continue"
      : "Start interview";

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--bg-base)] flex items-center justify-center">
      <div className="w-full max-w-lg mx-4 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-2xl p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white">Quick pre-check</h2>
          <p className="text-sm text-zinc-400 mt-2">
            Three short checks for a smooth interview: mic, speaker, connection.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-xs font-semibold text-zinc-300 flex items-center justify-center">
                  1
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Microphone</p>
                  <p className="text-xs text-zinc-500">{micHint()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {renderCheckIcon(micStatus)}
                <span className="text-xs text-zinc-400">{getStatusLabel(micStatus)}</span>
              </div>
            </div>

            {showAudioMeter && (
              <div className="mt-3">
                <p className="text-xs text-zinc-500 mb-2">
                  Say anything so we can see the level.
                </p>
                <div className="h-2 bg-[var(--bg-raised)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-75"
                    style={{
                      width: `${Math.min(100, audioMeterLevel * 500)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {micError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs font-medium text-red-300">{micError.title}</p>
                <p className="text-xs text-red-200/80 mt-1">{micError.body}</p>
                {micError.fix && (
                  <p className="text-xs text-zinc-500 mt-2">{micError.fix}</p>
                )}
              </div>
            )}

            {showDeviceSelector && audioInputDevices.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-zinc-500 mb-1">Try a different microphone:</p>
                <select
                  className="w-full bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-zinc-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500/50"
                  onChange={(e) => switchDevice(e.target.value)}
                  value=""
                >
                  <option value="">Select microphone...</option>
                  {audioInputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-xs font-semibold text-zinc-300 flex items-center justify-center">
                  2
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Speaker</p>
                  <p className="text-xs text-zinc-500">{speakerHint()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {renderCheckIcon(speakerStatus)}
                <span className="text-xs text-zinc-400">{getStatusLabel(speakerStatus)}</span>
              </div>
            </div>

            {showSpeakerConfirm && (
              <div className="mt-3 p-3 bg-[var(--bg-raised)] rounded-lg border border-[var(--border-subtle)]">
                <p className="text-xs text-zinc-300 text-center mb-3">
                  Did you hear a short beep?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSpeakerConfirm(false);
                      setCheckStateKey("speaker", "passed");
                      checkConnection();
                    }}
                    className="flex-1 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-xs hover:bg-emerald-600/30 transition-colors"
                  >
                    Yes, I heard it
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSpeakerConfirm(false);
                      setCheckStateKey("speaker", "warning");
                      setErrorMessage({
                        title: "Audio output not confirmed",
                        body:
                          "Check your system volume, make sure your speakers or headphones are connected, and that the browser is not muted.",
                        fix: "On Mac: check the speaker icon in the menu bar. On Windows: check Volume Mixer.",
                        source: "speaker",
                      });
                      checkConnection();
                    }}
                    className="flex-1 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-zinc-400 text-xs hover:bg-[var(--bg-overlay)] transition-colors"
                  >
                    No, I did not
                  </button>
                </div>
              </div>
            )}

            {speakerError && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs font-medium text-amber-300">{speakerError.title}</p>
                <p className="text-xs text-amber-200/80 mt-1">{speakerError.body}</p>
                {speakerError.fix && (
                  <p className="text-xs text-zinc-500 mt-2">{speakerError.fix}</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-xs font-semibold text-zinc-300 flex items-center justify-center">
                  3
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Connection</p>
                  <p className="text-xs text-zinc-500">{connectionHint()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {renderCheckIcon(connectionStatus)}
                <span className="text-xs text-zinc-400">{getStatusLabel(connectionStatus)}</span>
              </div>
            </div>

            {connectionWarning && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-200/80">{connectionWarning}</p>
              </div>
            )}

            {connectionError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs font-medium text-red-300">{connectionError.title}</p>
                <p className="text-xs text-red-200/80 mt-1">{connectionError.body}</p>
                <button
                  type="button"
                  onClick={routeToWebSocket}
                  className="mt-3 w-full py-2 rounded-lg bg-cyan-500 text-black text-xs font-medium hover:bg-cyan-400 transition-colors"
                >
                  Try WebSocket fallback
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAllPassed}
            disabled={!allChecksDone || hasBlockingFailure}
            className={`w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
              allChecksDone && !hasBlockingFailure
                ? "bg-cyan-500 hover:bg-cyan-400 text-black cursor-pointer"
                : "bg-[var(--bg-surface)] text-zinc-600 cursor-not-allowed border border-[var(--border-subtle)]"
            }`}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={handleSkipPrecheck}
            className="w-full py-2.5 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-[var(--border-subtle)] transition-colors"
          >
            Skip pre-check, I know it works
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-[var(--border-subtle)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function PreSessionCheckerWithBrowserCheck(props) {
  const unsupported = Object.entries(BROWSER_REQUIREMENTS)
    .filter(([, supported]) => !supported)
    .map(([name]) => name);

  if (unsupported.length > 0) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[var(--bg-base)] flex items-center justify-center">
        <div className="max-w-md mx-4 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-2xl p-8 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            Browser not supported
          </h2>
          <p className="text-sm text-zinc-400 mb-4">
            Roundr requires Chrome 90+ or Edge 90+ for voice interviews. Safari
            on iPhone is not yet supported.
          </p>
          <a
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2 bg-cyan-500 text-black rounded-lg text-sm font-medium"
          >
            Download Chrome
          </a>
        </div>
      </div>
    );
  }

  return <PreSessionChecker {...props} />;
}
