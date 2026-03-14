import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

const BROWSER_REQUIREMENTS = {
  audioWorklet: typeof AudioWorklet !== "undefined",
  getUserMedia: !!(navigator.mediaDevices?.getUserMedia),
  webSocket: typeof WebSocket !== "undefined",
};

const CHECK_KEYS = ["mic_permission", "mic_signal", "speaker", "connection"];

const getStatusLabel = (state) => {
  if (state === "pending") return "WAITING";
  if (state === "running") return "CHECKING";
  if (state === "passed") return "PASSED";
  if (state === "failed") return "FAILED";
  if (state === "warning") return "WARNING";
  return "WAITING";
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
            "Click the camera/mic icon in your browser address bar → Allow → then refresh this page.",
          fix: "How to allow mic in Chrome: Settings → Privacy → Microphone → Allow roundr.ai",
        });
      } else if (err.name === "NotFoundError") {
        setErrorMessage({
          title: "No microphone found",
          body: "Plug in a headset or check your system audio settings.",
          fix: null,
        });
      } else if (err.name === "NotReadableError") {
        setErrorMessage({
          title: "Microphone is in use by another app",
          body:
            "Close Zoom, Discord, Google Meet, or any other app using your mic, then try again.",
          fix: null,
        });
      } else {
        setErrorMessage({
          title: "Microphone error",
          body: `Could not access microphone: ${err.message}`,
          fix: null,
        });
      }
    }
  };

  const checkMicSignal = async (stream) => {
    setCheckStateKey("mic_signal", "running");
    setShowAudioMeter(true);
    setErrorMessage(null);

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
        if (maxRms < 0.005) {
          setCheckStateKey("mic_signal", "failed");
          setErrorMessage({
            title: "Microphone not picking up sound",
            body:
              "We detected your mic but no signal. Try speaking, check if muted in system settings, or select a different microphone.",
            fix: null,
          });
          setShowDeviceSelector(true);
          navigator.mediaDevices.enumerateDevices().then((devices) => {
            setAudioInputDevices(devices.filter((d) => d.kind === "audioinput"));
          });
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
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/livekit/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - start;

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (latency > 2000) {
        setCheckStateKey("connection", "warning");
        setConnectionWarning(
          `Your connection is slow (${latency}ms). The interview may experience delays. Try switching to a wired connection or disabling VPN.`
        );
      } else {
        setCheckStateKey("connection", "passed");
        if (sessionId && typeof getAuthToken === "function") {
          const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
          getAuthToken()
            .then((token) => {
              if (!token) return;
              fetch(`${apiUrl}/livekit/prewarm`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ session_id: sessionId }),
              }).catch((err) => console.warn("Prewarm failed", err));
            })
            .catch(() => {});
        }
      }
      setAllChecksDone(true);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        setCheckStateKey("connection", "failed");
        setErrorMessage({
          title: "Cannot reach Roundr servers",
          body:
            "Your network may be blocking the connection (common on corporate/university networks). Try: disable VPN, use mobile hotspot, or try a different network.",
          fix: null,
        });
      } else {
        setCheckStateKey("connection", "warning");
        setConnectionWarning(
          "Connection check inconclusive — you can still try to start."
        );
        setAllChecksDone(true);
      }
    }
  };

  // Run mic permission check once on mount; safe to ignore exhaustive-deps
  // because checkMicPermission does not change between renders in this usage.
  // Run mic permission check once on mount; checkMicPermission is stable for this usage.
  useEffect(() => {
    checkMicPermission();
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasBlockingFailure =
    checkState.mic_permission === "failed" || checkState.mic_signal === "failed";
  const connectionBlocking = checkState.connection === "failed";

  const renderCheckIcon = (key) => {
    const state = checkState[key];
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

  const checkLabels = {
    mic_permission: "Microphone permission",
    mic_signal: "Microphone signal",
    speaker: "Speaker output",
    connection: "Connection",
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--bg-base)] flex items-center justify-center">
      <div className="w-full max-w-md mx-4 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-2xl p-8">
        <h2 className="text-xl font-semibold text-white mb-6 text-center">
          Getting you ready for your interview
        </h2>

        <div className="space-y-0">
          {CHECK_KEYS.map((key) => (
            <div
              key={key}
              className="flex items-center gap-3 py-3 border-b border-[var(--border-subtle)] last:border-0"
            >
              {renderCheckIcon(key)}
              <span className="flex-1 text-sm text-zinc-300">
                {checkLabels[key]}
              </span>
              <span className="text-xs text-zinc-500">
                {getStatusLabel(checkState[key])}
              </span>
            </div>
          ))}
        </div>

        {showAudioMeter && (
          <div className="my-4">
            <p className="text-xs text-zinc-500 mb-2 text-center">
              Say anything to test your microphone...
            </p>
            <div className="h-3 bg-[var(--bg-raised)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-75"
                style={{
                  width: `${Math.min(100, audioMeterLevel * 500)}%`,
                }}
              />
            </div>
          </div>
        )}

        {showSpeakerConfirm && (
          <div className="my-4 p-4 bg-[var(--bg-raised)] rounded-xl border border-[var(--border-subtle)]">
            <p className="text-sm text-zinc-300 text-center mb-3">
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
                className="flex-1 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-sm hover:bg-emerald-600/30 transition-colors"
              >
                Yes, I heard it
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSpeakerConfirm(false);
                  setCheckStateKey("speaker", "failed");
                  setErrorMessage({
                    title: "Audio output not working",
                    body:
                      "Check your system volume, make sure your speakers/headphones are plugged in, and that the browser is not muted.",
                    fix: "On Mac: check the speaker icon in menu bar. On Windows: check Volume Mixer.",
                  });
                  setCheckStateKey("speaker", "warning");
                  checkConnection();
                }}
                className="flex-1 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-zinc-400 text-sm hover:bg-[var(--bg-overlay)] transition-colors"
              >
                No, I didn&apos;t
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-sm font-medium text-red-400 mb-1">
              {errorMessage.title}
            </p>
            <p className="text-xs text-red-300/80">{errorMessage.body}</p>
            {errorMessage.fix && (
              <p className="text-xs text-zinc-500 mt-2">{errorMessage.fix}</p>
            )}
          </div>
        )}

        {connectionWarning && (
          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-xs text-amber-300/80">{connectionWarning}</p>
          </div>
        )}

        {showDeviceSelector && audioInputDevices.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-1">
              Try a different microphone:
            </p>
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

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAllPassed}
            disabled={!allChecksDone || hasBlockingFailure || connectionBlocking}
            className={`w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
              allChecksDone && !hasBlockingFailure && !connectionBlocking
                ? "bg-cyan-500 hover:bg-cyan-400 text-black cursor-pointer"
                : "bg-[var(--bg-surface)] text-zinc-600 cursor-not-allowed border border-[var(--border-subtle)]"
            }`}
          >
            {allChecksDone ? "Start Interview" : "Running checks..."}
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
