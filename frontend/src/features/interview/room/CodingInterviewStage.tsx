import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  Braces,
  Mic,
  MicOff,
  PhoneOff,
  Timer,
  Video,
  VideoOff,
  AudioLines,
} from "lucide-react";
import toast from "react-hot-toast";

import CodeEditor, { type CodeEditorHandle } from "features/interview/coding/CodeEditor";
import DSAQuestionDisplay from "features/interview/coding/DSAQuestionDisplay";
import type { MicHealth } from "features/interview/preflight/MicHealthIndicator";
import { useLocalCameraPreview } from "features/interview/preflight/useLocalCameraPreview";
import { useSessionLogTurns } from "features/interview/session/hooks/useSessionLogTurns";
import { formatTurnRelative } from "features/interview/session/sessionLogTurns";
import SelfViewPip from "features/interview/room/SelfViewPip";
import "features/interview/room/coding-room.css";
import "features/interview/room/interview-room.css";

type Question = {
  title?: string;
  difficulty?: string;
  question_id?: string | number;
  [key: string]: unknown;
};

type Props = {
  sessionId: string;
  timer: string;
  status: string;
  aiSpeaking: boolean;
  aiFullText: string;
  transcriptFinal: string;
  transcriptInterim: string;
  micEnabled: boolean;
  micHealth: MicHealth;
  connected: boolean;
  currentQuestion: Question | null;
  loadingNextProblem: boolean;
  codeEditorRef: RefObject<CodeEditorHandle | null>;
  sendControl: (message: unknown) => void;
  onToggleMic: (enabled: boolean) => void;
  onRequestNextQuestion: () => void;
  onEndInterview: () => void;
};

function micChip(health: MicHealth): { label: string; tone: "ok" | "warn" | "bad" } {
  if (health === "ok") return { label: "Mic Good", tone: "ok" };
  if (health === "quiet") return { label: "Mic Quiet", tone: "warn" };
  if (health === "reconnecting") return { label: "Mic Reconnecting", tone: "warn" };
  return { label: "No Mic Signal", tone: "bad" };
}

function aiMode(status: string, aiSpeaking: boolean): "speaking" | "listening" | "thinking" {
  if (status === "thinking") return "thinking";
  if (aiSpeaking || status === "speaking") return "speaking";
  return "listening";
}

export default function CodingInterviewStage({
  sessionId,
  timer,
  status,
  aiSpeaking,
  aiFullText,
  transcriptFinal,
  transcriptInterim,
  micEnabled,
  micHealth,
  connected,
  currentQuestion,
  loadingNextProblem,
  codeEditorRef,
  sendControl,
  onToggleMic,
  onRequestNextQuestion,
  onEndInterview,
}: Props) {
  const turns = useSessionLogTurns({
    aiFullText,
    aiSpeaking,
    transcriptFinal,
    transcriptInterim,
  });
  const camera = useLocalCameraPreview(false);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const mode = aiMode(status, aiSpeaking);
  const chip = micChip(micHealth);

  useEffect(() => {
    if (camera.errorMessage) toast.error(camera.errorMessage);
  }, [camera.errorMessage]);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const toggleCamera = useCallback(() => {
    if (camera.isLive) {
      camera.stop();
      return;
    }
    void camera.start();
  }, [camera.isLive, camera.start, camera.stop]);

  const liveAgentText = (aiFullText || "").trim();
  const showSubtitle = Boolean(liveAgentText && (aiSpeaking || mode === "speaking"));

  return (
    <div className="dsa-room">
      <header className="dsa-header">
        <div className="dsa-header__left">
          <div className="dsa-active">
            <span className="dsa-active__ping" aria-hidden>
              <span className="dsa-active__ping-ring" />
              <span className="dsa-active__ping-core" />
            </span>
            <span className="dsa-active__label">
              {connected ? "Session Active" : "Connecting"}
            </span>
          </div>
          <span className="dsa-mode-chip-wrap">
            <span className="dsa-header__sep" aria-hidden />
            <span className="dsa-mode-chip">
              <span className="dsa-mode-chip__dot" aria-hidden />
              Pair Programming · DSA
            </span>
          </span>
          <span className="dsa-header__sep" aria-hidden />
          <span className="dsa-timer" aria-live="polite">
            <Timer size={16} aria-hidden />
            <span className="tabular-nums">{timer}</span>
          </span>
        </div>
        <div className="dsa-header__right">
          <div
            className={`dsa-mic-chip ${
              chip.tone === "ok" ? "" : chip.tone === "warn" ? "dsa-mic-chip--warn" : "dsa-mic-chip--bad"
            }`}
          >
            <Mic size={14} aria-hidden />
            {chip.label}
          </div>
          <button
            type="button"
            className="dsa-end-btn"
            onClick={onEndInterview}
            aria-label="End interview"
          >
            <PhoneOff size={18} aria-hidden />
            <span>End Interview</span>
          </button>
        </div>
      </header>

      <div className="dsa-workspace">
        <div className="dsa-main">
          <div className="dsa-problem">
            {currentQuestion ? (
              <>
                <div className="dsa-problem__head">
                  <Braces size={22} className="text-[var(--color-primary)]" aria-hidden />
                  <h2 className="dsa-problem__title">{currentQuestion.title || "Problem"}</h2>
                  {currentQuestion.difficulty ? (
                    <span className="dsa-problem__diff">{currentQuestion.difficulty}</span>
                  ) : null}
                </div>
                <div className="dsa-problem__body">
                  <DSAQuestionDisplay question={currentQuestion} embedded />
                </div>
              </>
            ) : (
              <p className="dsa-problem__empty">
                {loadingNextProblem ? "Loading next problem…" : "Waiting for problem…"}
              </p>
            )}
          </div>

          <div className="dsa-editor">
            <CodeEditor
              ref={codeEditorRef}
              sessionId={sessionId}
              question={currentQuestion}
              onRequestNextQuestion={onRequestNextQuestion}
              loadingNextProblem={loadingNextProblem}
              onControlMessage={sendControl}
            />
          </div>

          {showSubtitle ? (
            <div className="dsa-subtitle">
              <div className="dsa-subtitle__panel">
                <p className="dsa-subtitle__text">&ldquo;{liveAgentText}&rdquo;</p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="dsa-side" aria-label="Analysis stream">
          <div className="dsa-ai">
            <div
              className={`dsa-ai__glow dsa-ai__glow--${mode}`}
              aria-hidden
            />
            <div className="dsa-ai__row">
              <span className={`dsa-ai__dot dsa-ai__dot--${mode}`} aria-hidden />
              <span className={`dsa-ai__label dsa-ai__label--${mode}`}>
                {mode === "speaking"
                  ? "Collaborator speaking"
                  : mode === "thinking"
                    ? "Collaborator thinking"
                    : "Collaborator listening"}
              </span>
            </div>
            <div
              className={`dsa-wave ${mode === "speaking" ? "" : `dsa-wave--idle dsa-wave--${mode}`}`}
              aria-hidden
            >
              <span className="dsa-wave__bar" />
              <span className="dsa-wave__bar" />
              <span className="dsa-wave__bar" />
              <span className="dsa-wave__bar" />
              <span className="dsa-wave__bar" />
            </div>
          </div>

          <div ref={streamRef} className="dsa-stream">
            <div className="dsa-stream__head">
              <h3 className="dsa-stream__title">Analysis Stream</h3>
              <AudioLines size={18} className="text-[var(--text-tertiary)]" aria-hidden />
            </div>
            {turns.length === 0 ? (
              <p className="dsa-stream__empty">
                Conversation and coaching prompts appear here as you code.
              </p>
            ) : (
              <div className="dsa-stream__list">
                {turns.map((turn) => {
                  const isYou = turn.role === "you";
                  return (
                    <div
                      key={turn.id}
                      className={`dsa-turn ${isYou ? "dsa-turn--you" : ""} ${
                        turn.streaming && !isYou ? "dsa-turn--live" : ""
                      }`}
                    >
                      <span className="dsa-turn__meta">
                        {isYou ? "You" : "Collaborator"}
                        {" — "}
                        {turn.streaming ? "Just now" : formatTurnRelative(turn.at)}
                      </span>
                      <p className="dsa-turn__text">{turn.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="dsa-dock" role="toolbar" aria-label="Session controls">
            <button
              type="button"
              className={`dsa-dock__btn ${micEnabled ? "" : "dsa-dock__btn--off"}`}
              title={micEnabled ? "Mute microphone" : "Unmute microphone"}
              aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
              onClick={() => onToggleMic(!micEnabled)}
            >
              {micEnabled ? <Mic size={20} aria-hidden /> : <MicOff size={20} aria-hidden />}
            </button>
            <button
              type="button"
              className={`dsa-dock__btn ${camera.isLive ? "" : "dsa-dock__btn--off"}`}
              title={camera.isLive ? "Turn camera off" : "Turn camera on"}
              aria-label={camera.isLive ? "Turn camera off" : "Turn camera on"}
              onClick={toggleCamera}
            >
              {camera.isLive ? <Video size={20} aria-hidden /> : <VideoOff size={20} aria-hidden />}
            </button>
          </div>
        </aside>
      </div>

      <SelfViewPip
        videoRef={camera.videoRef}
        visible={camera.isLive}
        micEnabled={micEnabled}
      />
    </div>
  );
}
