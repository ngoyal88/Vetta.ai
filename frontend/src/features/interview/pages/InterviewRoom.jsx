// WebSocket-based interview room page (fallback when LiveKit is unavailable).
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ChevronRight } from "lucide-react";

import { useConfirmDialog } from "shared/context/ConfirmDialogContext";
import { useInterviewWebSocketAdapter } from "features/interview/hooks/websocket/useInterviewWebSocketAdapter";
import Subtitles from "features/interview/components/Subtitles";
import CodeEditor from "features/interview/components/CodeEditor";
import DSAQuestionDisplay from "features/interview/components/DSAQuestionDisplay";
import InterviewRoomHeader from "features/interview/components/InterviewRoomHeader";
import VoiceControlBar from "features/interview/components/VoiceControlBar";
import FeedbackCard from "features/interview/components/FeedbackCard";
import DSASplitLayout from "features/interview/components/DSASplitLayout";
import { fadeInUp, slidePhase } from "shared/utils/animations";

const InterviewRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  return <InterviewRoomWSContent sessionId={sessionId} onBack={() => navigate("/dashboard")} />;
};

const InterviewRoomWSContent = ({ sessionId, onBack }) => {
  const { confirmDialog } = useConfirmDialog();
  const storedType = sessionStorage.getItem(`interview_type_${sessionId}`);
  const initialPhase = storedType === "dsa" ? "dsa" : "behavioral";

  const {
    connected, error, currentQuestion, phase,
    transcriptInterim, transcriptFinal,
    aiText, aiFullText, aiSpeechWpm, aiSpeaking,
    feedback, isRecording, micEnabled,
    startRecording, stopRecording, submitAnswer, toggleMicrophone,
    skipQuestion, requestNextDSAQuestion, loadingNextProblem,
    endInterview, audioLevel,
  } = useInterviewWebSocketAdapter(sessionId, initialPhase);

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
      message: "Are you sure you want to end the interview?",
      destructive: true,
      onConfirm: () => { setInterviewEnded(true); endInterview(); },
    });
  };

  if (interviewEnded) {
    return (
      <div className="h-screen flex flex-col bg-base overflow-hidden">
        {error && <div role="alert" aria-live="assertive" className="sr-only">{error}</div>}
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
                <p className="font-mono text-xs text-[var(--text-tertiary)]">{'// Analyzing session data…'}</p>
              </div>
            )}
          </div>
        </div>
        <footer className="h-14 shrink-0 px-6 flex items-center border-t border-[var(--border)] bg-raised">
          <button type="button" onClick={onBack} className="btn-ghost text-xs flex items-center gap-1.5">
            <ChevronRight size={12} className="rotate-180" />
            {feedback ? "Back to dashboard" : "Back without waiting"}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      {error && <div role="alert" aria-live="assertive" className="sr-only">{error}</div>}

      <InterviewRoomHeader
        connected={connected}
        phase={phase}
        onSkip={phase === "dsa" ? requestNextDSAQuestion : skipQuestion}
        onEndInterview={handleEndInterview}
        loadingNextProblem={loadingNextProblem}
        timer={phase === "dsa" ? formatTimer(elapsedSeconds) : null}
        difficulty={currentQuestion?.difficulty || null}
        transport="WebSocket"
      />

      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          {phase === "dsa" ? (
            <motion.div key="dsa" {...slidePhase.dsa} className="h-full">
              <DSASplitLayout
                questionPanel={
                  currentQuestion ? (
                    <DSAQuestionDisplay question={currentQuestion} />
                  ) : (
                    <div className="p-4 space-y-2 animate-pulse">
                      {[100, 80, 90, 60].map((w, i) => (
                        <div key={i} className="h-3 rounded-sm bg-[var(--bg-surface)]" style={{ width: `${w}%` }} />
                      ))}
                      <p className="font-mono text-[10px] text-[var(--text-tertiary)] pt-2">
                        {loadingNextProblem ? "// loading next problem…" : "// loading…"}
                      </p>
                    </div>
                  )
                }
                codePanel={
                  <CodeEditor
                    sessionId={sessionId}
                    question={currentQuestion}
                    onRequestNextQuestion={requestNextDSAQuestion}
                    loadingNextProblem={loadingNextProblem}
                  />
                }
              />
            </motion.div>
          ) : (
            <motion.div key="voice" {...slidePhase.voice} className="h-full flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
                <div className="w-full max-w-xl flex flex-col items-center">
                  {/* Waveform */}
                  <div className="flex items-end gap-[3px] mb-6" style={{ height: 72 }} aria-hidden>
                    {Array.from({ length: 20 }, (_, i) => 0.3 + 0.7 * Math.sin((i / 20) * Math.PI)).map((h, i) => (
                      <motion.span
                        key={i}
                        className="w-[3px] rounded-sm"
                        style={{ background: aiSpeaking ? "var(--indigo)" : "var(--border)", transformOrigin: "bottom" }}
                        animate={aiSpeaking ? { scaleY: [h, 1 - h * 0.3, h] } : { scaleY: 0.25 }}
                        transition={aiSpeaking ? { duration: 0.7 + i * 0.04, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
                        initial={{ scaleY: h }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-medium text-white">AI Interviewer</p>
                  <p className="font-mono text-[10px] text-[var(--text-tertiary)] mt-0.5">
                    {aiSpeaking ? <span className="text-indigo">speaking</span> : "listening"}
                  </p>
                  {(transcriptFinal || transcriptInterim) && (
                    <p className="text-[10px] font-mono text-indigo/80 mt-4">
                      You: {transcriptFinal}
                      {transcriptInterim && <span className="opacity-60"> {transcriptInterim}</span>}
                    </p>
                  )}
                </div>
              </div>

              <Subtitles text={aiFullText || aiText} isSpeaking={aiSpeaking} wpm={aiSpeechWpm || 180} />

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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
        />
      )}
    </div>
  );
};

export default InterviewRoom;
