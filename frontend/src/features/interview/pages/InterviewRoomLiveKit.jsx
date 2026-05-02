import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Activity, Cpu, Radio, AlertTriangle, ChevronRight,
} from "lucide-react";

import { useConfirmDialog } from "shared/context/ConfirmDialogContext";
import { useInterviewLiveKitAdapter } from "features/interview/hooks/useInterviewLiveKitAdapter";
import AudioVisualizer from "features/interview/components/AudioVisualizer";
import Subtitles from "features/interview/components/Subtitles";
import CodeEditor from "features/interview/components/CodeEditor";
import DSAQuestionDisplay from "features/interview/components/DSAQuestionDisplay";
import InterviewRoomHeader from "features/interview/components/InterviewRoomHeader";
import VoiceControlBar from "features/interview/components/VoiceControlBar";
import FeedbackCard from "features/interview/components/FeedbackCard";
import InterviewerThinking from "features/interview/components/InterviewerThinking";
import { SessionBanner } from "features/interview/components/SessionBanner";
import { ReconnectOverlay } from "features/interview/components/ReconnectOverlay";
import { TextInputFallback } from "features/interview/components/TextInputFallback";
import { fadeInUp, slidePhase } from "shared/utils/animations";

/* ── Candidate metrics side panel ── */
const MetricsPanel = ({ aiSpeaking, audioLevel, status, transcriptFinal, transcriptInterim, phase }) => {
  const [sentiment, setSentiment] = useState(72);
  const [accuracy, setAccuracy] = useState(85);
  const [clarity, setClarity] = useState(78);

  // Simulate metric drift
  useEffect(() => {
    const id = setInterval(() => {
      const drift = (v) => Math.min(99, Math.max(40, v + (Math.random() - 0.5) * 4));
      setSentiment(drift);
      setAccuracy(drift);
      setClarity(drift);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const MetricRow = ({ label, value, color = "bg-indigo" }) => (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
        <span className="font-mono text-[10px] text-white tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="h-[2px] bg-[var(--border)] rounded-full overflow-hidden">
        <motion.div
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );

  return (
    <aside className="w-52 shrink-0 border-r border-[var(--border)] bg-raised flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-9 px-3 flex items-center border-b border-[var(--border)]">
        <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
          Candidate Metrics
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {/* Live metrics */}
        <div className="space-y-3">
          <MetricRow label="Sentiment"  value={sentiment}  color="bg-emerald" />
          <MetricRow label="Accuracy"   value={accuracy}   color="bg-indigo"  />
          <MetricRow label="Clarity"    value={clarity}    color="bg-indigo"  />
        </div>

        <div className="border-t border-[var(--border)] pt-3 space-y-2">
          <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Status</p>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-[5px] h-[5px] rounded-full ${aiSpeaking ? "bg-indigo" : "bg-emerald"}`}
              style={aiSpeaking ? { boxShadow: "0 0 6px #6366F1" } : { boxShadow: "0 0 6px #10B981" }}
            />
            <span className="font-mono text-[10px] text-[var(--text-secondary)]">
              {status === "thinking" ? "thinking…" : aiSpeaking ? "AI speaking" : "listening"}
            </span>
          </div>
        </div>

        {/* Transcript feed */}
        {(transcriptFinal || transcriptInterim) && (
          <div className="border-t border-[var(--border)] pt-3">
            <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">You</p>
            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
              {transcriptFinal}
              {transcriptInterim && (
                <span className="text-[var(--text-tertiary)]"> {transcriptInterim}</span>
              )}
            </p>
          </div>
        )}

        {/* Proctoring */}
        <div className="border-t border-[var(--border)] pt-3">
          <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Proctoring</p>
          <div className="space-y-1.5">
            {[
              { label: "Audio",   ok: true  },
              { label: "Mic",     ok: true  },
              { label: "Session", ok: true  },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{item.label}</span>
                <span className={`font-mono text-[10px] ${item.ok ? "text-emerald" : "text-red-400"}`}>
                  {item.ok ? "pass" : "fail"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audio level bar */}
      <div className="h-8 px-3 border-t border-[var(--border)] flex items-center gap-2">
        <Radio size={9} className="text-[var(--text-tertiary)]" />
        <div className="flex-1 h-[2px] bg-[var(--border)] rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${(audioLevel || 0) * 100}%` }}
            transition={{ duration: 0.1 }}
            className="h-full bg-indigo"
          />
        </div>
      </div>
    </aside>
  );
};

/* ── Eval log panel (right, for voice phase) ── */
const EvalLogPanel = ({ aiText, aiFullText, aiSpeaking, status, feedback }) => {
  const [logs, setLogs] = useState([
    { t: "sys", msg: "session initialized" },
    { t: "ok",  msg: "audio channel open" },
    { t: "ok",  msg: "AI agent connected" },
  ]);
  const ref = useRef(null);

  useEffect(() => {
    if (aiSpeaking) {
      setLogs((l) => [...l, { t: "ai", msg: "agent speaking…" }]);
    }
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [aiSpeaking]);

  useEffect(() => {
    if (feedback) {
      setLogs((l) => [...l, { t: "ok", msg: "feedback generated" }]);
    }
  }, [feedback]);

  const colors = { sys: "text-[var(--text-tertiary)]", ok: "text-emerald", ai: "text-indigo", warn: "text-yellow-400" };

  return (
    <aside className="w-52 shrink-0 border-l border-[var(--border)] bg-raised flex flex-col overflow-hidden">
      <div className="h-9 px-3 flex items-center border-b border-[var(--border)]">
        <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">Eval Log</span>
        {status === "thinking" && (
          <span className="ml-auto badge-online text-[9px]">PROC</span>
        )}
      </div>

      <div ref={ref} className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {logs.map((l, i) => (
          <div key={i} className="flex gap-1.5 font-mono text-[0.6rem]">
            <span className="text-[var(--text-muted)] tabular-nums w-4 text-right">{String(i + 1).padStart(2, "0")}</span>
            <span className={colors[l.t] || "text-[var(--text-secondary)]"}>{l.msg}</span>
          </div>
        ))}
      </div>

      {/* AI speech text */}
      {(aiFullText || aiText) && (
        <div className="border-t border-[var(--border)] p-3">
          <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">AI</p>
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed line-clamp-4">
            {aiFullText || aiText}
          </p>
        </div>
      )}
    </aside>
  );
};

/* ── Waveform visualizer (center panel) ── */
const WaveformCenter = ({ aiSpeaking, audioLevel, status }) => {
  const BARS = 24;
  const heights = Array.from({ length: BARS }, (_, i) => 0.3 + 0.7 * Math.sin((i / BARS) * Math.PI));

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      {/* Waveform */}
      <div className="flex items-end gap-[3px]" style={{ height: 80 }} aria-hidden>
        {heights.map((h, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-sm"
            style={{ background: aiSpeaking ? "var(--indigo)" : "var(--border-strong)", transformOrigin: "bottom" }}
            animate={
              aiSpeaking
                ? { scaleY: [h, 1 - h * 0.4, h], opacity: [0.8, 1, 0.8] }
                : { scaleY: 0.25, opacity: 0.3 }
            }
            transition={
              aiSpeaking
                ? { duration: 0.6 + i * 0.05, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
            }
            initial={{ scaleY: h }}
          />
        ))}
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-xs font-medium text-white">AI Interviewer</p>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] mt-0.5">
          {status === "thinking" ? (
            <span className="flex items-center justify-center gap-1.5 text-indigo">
              <span className="w-[4px] h-[4px] rounded-full bg-indigo animate-ping inline-block" />
              processing…
            </span>
          ) : aiSpeaking ? (
            <span className="text-indigo">speaking</span>
          ) : (
            <span>listening</span>
          )}
        </p>
      </div>
    </div>
  );
};

/* ── Post-interview feedback screen ── */
const FeedbackScreen = ({ feedback, onBack }) => (
  <div className="h-screen flex flex-col bg-base overflow-hidden">
    <header className="h-11 shrink-0 px-4 flex items-center border-b border-[var(--border)] bg-raised">
      <div className="filepath">
        <span className="segment">~/interviews</span>
        <span className="sep">/</span>
        <span className="active-segment">session-report</span>
      </div>
    </header>
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-4">Session complete</p>
        <h1 className="text-xl font-semibold text-white mb-1">Interview report</h1>
        <p className="text-xs text-[var(--text-secondary)] mb-6">
          {feedback ? "Analysis complete." : "Generating report — this takes a moment."}
        </p>
        {feedback ? (
          <FeedbackCard
            feedback={typeof feedback === "string" ? feedback : feedback?.feedback ?? ""}
            scores={typeof feedback === "object" && feedback?.full?.scores ? feedback.full.scores : undefined}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-8 h-8 border border-indigo/30 border-t-indigo rounded-sm animate-spin" />
            <p className="font-mono text-xs text-[var(--text-tertiary)]">// Analyzing session data…</p>
          </div>
        )}
      </div>
    </div>
    <footer className="h-14 shrink-0 px-6 flex items-center border-t border-[var(--border)] bg-raised">
      <button
        type="button"
        onClick={onBack}
        className="btn-ghost text-xs flex items-center gap-1.5"
      >
        <ChevronRight size={12} className="rotate-180" />
        {feedback ? "Back to dashboard" : "Back without waiting"}
      </button>
    </footer>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════ */

const InterviewRoomLiveKit = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  return <InterviewRoomLiveKitContent sessionId={sessionId} onBack={() => navigate("/dashboard")} />;
};

const InterviewRoomLiveKitContent = ({ sessionId, onBack }) => {
  const { confirmDialog } = useConfirmDialog();
  const storedType = sessionStorage.getItem(`interview_type_${sessionId}`);
  const initialPhase = storedType === "dsa" ? "dsa" : "behavioral";

  const [banners, setBanners] = useState([]);
  const addBanner = (type, message, autoDismissMs = null) => {
    const id = Date.now();
    setBanners((prev) => [...prev, { id, type, message, autoDismissMs }]);
    return id;
  };
  const removeBanner = (id) => setBanners((prev) => prev.filter((b) => b.id !== id));
  const removeBannerByType = (type) => setBanners((prev) => prev.filter((b) => b.type !== type));

  const codeEditorRef = useRef(null);

  const {
    connected, error, status, currentQuestion, phase,
    transcriptInterim, transcriptFinal,
    aiText, aiFullText, aiSpeechWpm, aiSpeaking,
    feedback, isRecording, micEnabled,
    startRecording, stopRecording, submitAnswer, toggleMicrophone,
    skipQuestion, requestNextDSAQuestion, loadingNextProblem,
    endInterview, disconnect, audioLevel, sendControl,
    fallbackToWebSocket, reconnecting, reconnectAttempt, sttFallbackActive,
  } = useInterviewLiveKitAdapter(sessionId, initialPhase, {
    addBanner, removeBanner, removeBannerByType, codeEditorRef,
  });

  useEffect(() => { if (error) toast.error(error); }, [error]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const timerStartedRef = useRef(false);

  useEffect(() => {
    if (phase === "dsa" && currentQuestion && !timerStartedRef.current) {
      timerStartedRef.current = true;
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (phase !== "dsa") {
        clearInterval(timerRef.current);
        timerStartedRef.current = false;
        setElapsedSeconds(0);
      }
    };
  }, [phase, currentQuestion]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const formatTimer = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const [interviewEnded, setInterviewEnded] = useState(false);

  const handleEndInterview = () => {
    confirmDialog({
      title: "End interview",
      message: "Are you sure you want to end this session?",
      destructive: true,
      onConfirm: () => { disconnect(); setInterviewEnded(true); endInterview(); },
    });
  };

  const showFallback = error && (
    error.includes("standard connection") ||
    error.includes("didn't connect") ||
    error.includes("Could not start")
  );

  if (interviewEnded) return <FeedbackScreen feedback={feedback} onBack={onBack} />;

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      {/* SR error announcer */}
      {error && <div role="alert" aria-live="assertive" className="sr-only">{error}</div>}

      {/* Fallback banner */}
      {showFallback && (
        <div className="shrink-0 px-4 py-2 border-b border-yellow-500/30 bg-yellow-500/5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-300 truncate">{error}</p>
          </div>
          <button
            type="button"
            onClick={fallbackToWebSocket}
            className="shrink-0 btn-ghost text-xs h-7"
          >
            Use standard connection
          </button>
        </div>
      )}

      {/* Header */}
      <InterviewRoomHeader
        connected={connected}
        phase={phase}
        onSkip={phase === "dsa" ? requestNextDSAQuestion : skipQuestion}
        onEndInterview={handleEndInterview}
        loadingNextProblem={loadingNextProblem}
        timer={phase === "dsa" ? formatTimer(elapsedSeconds) : null}
        difficulty={currentQuestion?.difficulty || null}
        transport="LiveKit"
      />

      {/* Banners */}
      {banners.map((b) => (
        <SessionBanner key={b.id} type={b.type} message={b.message} autoDismissMs={b.autoDismissMs} onDismiss={() => removeBanner(b.id)} />
      ))}

      {reconnecting && (
        <ReconnectOverlay attempt={reconnectAttempt} onGiveUp={() => { disconnect(); endInterview(); onBack(); }} />
      )}

      {sttFallbackActive && (
        <TextInputFallback onSubmit={(text) => sendControl({ type: "text_answer", text })} />
      )}

      {/* Main area */}
      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          {/* ── DSA phase: metrics pane | code split | eval log ── */}
          {phase === "dsa" ? (
            <motion.div key="dsa" {...slidePhase.dsa} className="h-full flex">
              {/* Left metrics */}
              <MetricsPanel
                aiSpeaking={aiSpeaking}
                audioLevel={audioLevel}
                status={status}
                transcriptFinal={transcriptFinal}
                transcriptInterim={transcriptInterim}
                phase={phase}
              />

              {/* Center: question + code editor */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Question pane */}
                <div className="h-full overflow-hidden">
                  <div className="h-full flex flex-col md:flex-row">
                    {/* Question */}
                    <div className="md:w-2/5 overflow-y-auto p-4 border-r border-[var(--border)] custom-scrollbar">
                      <div className="h-8 flex items-center mb-3 border-b border-[var(--border)] pb-2">
                        <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">Problem</span>
                        {status === "thinking" && (
                          <div className="ml-auto flex items-center gap-1.5">
                            <InterviewerThinking />
                            <span className="font-mono text-[10px] text-indigo">thinking</span>
                          </div>
                        )}
                      </div>
                      {currentQuestion ? (
                        <div className="animate-fade-in">
                          <div className="flex items-center gap-2 mb-3">
                            <h2 className="text-sm font-semibold text-white">{currentQuestion.title}</h2>
                            {currentQuestion.difficulty && (
                              <span className={`font-mono text-[10px] ${
                                currentQuestion.difficulty === 'easy' ? 'text-emerald' :
                                currentQuestion.difficulty === 'hard' ? 'text-red-400' : 'text-yellow-400'
                              }`}>
                                {currentQuestion.difficulty}
                              </span>
                            )}
                          </div>
                          <DSAQuestionDisplay question={currentQuestion} />
                        </div>
                      ) : (
                        <div className="space-y-2 animate-pulse">
                          {[100, 80, 90, 60].map((w, i) => (
                            <div key={i} className="h-3 rounded-sm bg-[var(--bg-surface)]" style={{ width: `${w}%` }} />
                          ))}
                          <p className="font-mono text-[10px] text-[var(--text-tertiary)] pt-2">
                            {loadingNextProblem ? "// loading next problem…" : "// loading…"}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Code editor */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <div className="h-8 px-4 flex items-center border-b border-[var(--border)]">
                        <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">Editor</span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <CodeEditor
                          ref={codeEditorRef}
                          sessionId={sessionId}
                          question={currentQuestion}
                          onRequestNextQuestion={requestNextDSAQuestion}
                          loadingNextProblem={loadingNextProblem}
                          onControlMessage={sendControl}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: eval log panel */}
              <EvalLogPanel
                aiText={aiText}
                aiFullText={aiFullText}
                aiSpeaking={aiSpeaking}
                status={status}
                feedback={feedback}
              />
            </motion.div>
          ) : (
            /* ── Voice/behavioral phase: metrics | waveform | eval log ── */
            <motion.div key="voice" {...slidePhase.voice} className="h-full flex">
              {/* Left metrics */}
              <MetricsPanel
                aiSpeaking={aiSpeaking}
                audioLevel={audioLevel}
                status={status}
                transcriptFinal={transcriptFinal}
                transcriptInterim={transcriptInterim}
                phase={phase}
              />

              {/* Center: waveform + subtitles */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 flex items-center justify-center p-6">
                  <WaveformCenter aiSpeaking={aiSpeaking} audioLevel={audioLevel} status={status} />
                </div>

                {/* Subtitles bar */}
                <div className="shrink-0">
                  <Subtitles text={aiFullText || aiText} isSpeaking={aiSpeaking} wpm={aiSpeechWpm || 180} />
                </div>

                {/* Feedback */}
                <AnimatePresence>
                  {feedback && (
                    <motion.div {...fadeInUp} className="px-6 pb-4 max-w-3xl mx-auto w-full">
                      <FeedbackCard
                        feedback={typeof feedback === "string" ? feedback : feedback?.feedback ?? ""}
                        scores={typeof feedback === "object" && feedback?.full?.scores ? feedback.full.scores : undefined}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right eval log */}
              <EvalLogPanel
                aiText={aiText}
                aiFullText={aiFullText}
                aiSpeaking={aiSpeaking}
                status={status}
                feedback={feedback}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Voice control bar */}
      {phase !== "dsa" && (
        <VoiceControlBar
          micEnabled={micEnabled}
          isRecording={isRecording}
          aiSpeaking={aiSpeaking}
          audioLevel={audioLevel}
          onToggleMic={toggleMicrophone}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onSubmitAnswer={submitAnswer}
          alwaysListening
          phase={phase}
          connected={connected}
        />
      )}
    </div>
  );
};

export default InterviewRoomLiveKit;
