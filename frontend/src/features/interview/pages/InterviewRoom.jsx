import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

import { useConfirmDialog } from "shared/context/ConfirmDialogContext";
import { useInterviewWebSocket } from "features/interview/hooks/useInterviewWebSocket";
import AudioVisualizer from "features/interview/components/AudioVisualizer";
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

  return (
    <InterviewRoomWSContent
      sessionId={sessionId}
      onBack={() => navigate("/dashboard")}
    />
  );
};

const InterviewRoomWSContent = ({ sessionId, onBack }) => {
  const { confirmDialog } = useConfirmDialog();
  const storedType = sessionStorage.getItem(`interview_type_${sessionId}`);
  const initialPhase = storedType === 'dsa' ? 'dsa' : 'behavioral';
  const {
    connected,
    error,
    currentQuestion,
    phase,
    transcriptInterim,
    transcriptFinal,
    aiText,
    aiFullText,
    aiSpeechWpm,
    aiSpeaking,
    feedback,
    isRecording,
    micEnabled,
    startRecording,
    stopRecording,
    submitAnswer,
    toggleMicrophone,
    skipQuestion,
    requestNextDSAQuestion,
    loadingNextProblem,
    endInterview,
    audioLevel
  } = useInterviewWebSocket(sessionId, initialPhase);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // DSA session timer — starts when the first question arrives
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const timerStartedRef = useRef(false);

  useEffect(() => {
    if (phase === 'dsa' && currentQuestion && !timerStartedRef.current) {
      timerStartedRef.current = true;
      timerRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (phase !== 'dsa') {
        clearInterval(timerRef.current);
        timerStartedRef.current = false;
        setElapsedSeconds(0);
      }
    };
  }, [phase, currentQuestion]);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Accessibility: announce errors to screen readers
  const errorAnnouncer = error ? (
    <div role="alert" aria-live="assertive" className="sr-only">
      {error}
    </div>
  ) : null;

  const [interviewEnded, setInterviewEnded] = useState(false);

  const handleEndInterview = () => {
    confirmDialog({
      title: 'End interview',
      message: 'Are you sure you want to end the interview?',
      destructive: true,
      onConfirm: () => {
        setInterviewEnded(true);
        endInterview();
      },
    });
  };

  const handleBackAfterFeedback = () => {
    onBack();
  };

  // Post-interview view: scrollable feedback + sticky "Back to Dashboard"
  if (interviewEnded) {
    return (
      <div className="h-screen flex flex-col bg-base overflow-hidden">
        {errorAnnouncer}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full">
            <h1 className="text-2xl font-bold text-white mb-2">Thank you for completing the interview</h1>
            <p className="text-zinc-500 mb-6">
              {feedback ? 'Here is your feedback.' : 'Generating your feedback...'}
            </p>
            {feedback ? (
              <FeedbackCard
                feedback={typeof feedback === 'string' ? feedback : (feedback?.feedback ?? '')}
                scores={typeof feedback === 'object' && feedback?.full?.scores ? feedback.full.scores : undefined}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="h-10 w-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" aria-hidden />
                <p className="text-zinc-500 text-sm">This may take a moment.</p>
              </div>
            )}
          </div>
        </div>
        <footer className="flex-shrink-0 p-6 border-t border-[var(--border-subtle)] bg-raised">
          <div className="max-w-3xl mx-auto w-full">
            <button
              type="button"
              onClick={handleBackAfterFeedback}
              className="w-full h-10 px-6 rounded-lg bg-overlay border border-cyan-500 text-white font-medium hover:border-cyan-400 transition-colors"
            >
              {feedback ? 'Back to Dashboard' : 'Back to Dashboard without waiting'}
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      {errorAnnouncer}
      <InterviewRoomHeader
        connected={connected}
        phase={phase}
        onSkip={phase === 'dsa' ? requestNextDSAQuestion : skipQuestion}
        onEndInterview={handleEndInterview}
        loadingNextProblem={loadingNextProblem}
        timer={phase === 'dsa' ? formatTimer(elapsedSeconds) : null}
        difficulty={currentQuestion?.difficulty || null}
        transport="WebSocket"
      />

      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          {phase === 'dsa' ? (
            <motion.div key="dsa" {...slidePhase.dsa} className="h-full">
              <DSASplitLayout
                questionPanel={
                  currentQuestion
                    ? <DSAQuestionDisplay question={currentQuestion} />
                    : (
                        <div className="bg-overlay p-6 rounded-xl border border-[var(--border-subtle)] animate-pulse space-y-4 h-full">
                          <div className="flex justify-between items-center">
                            <div className="h-6 bg-raised rounded w-2/3" />
                            <div className="h-5 bg-raised rounded w-16" />
                          </div>
                          <div className="space-y-2">
                            <div className="h-4 bg-raised rounded w-full" />
                            <div className="h-4 bg-raised rounded w-5/6" />
                            <div className="h-4 bg-raised rounded w-4/6" />
                          </div>
                          <div className="h-4 bg-raised rounded w-1/3 mt-4" />
                          <div className="space-y-2">
                            <div className="h-3 bg-raised rounded w-full" />
                            <div className="h-3 bg-raised rounded w-3/4" />
                          </div>
                          <p className="text-xs text-zinc-500 pt-2">
                            {loadingNextProblem ? 'Loading next problem...' : 'Loading problem...'}
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
                <div className="w-full max-w-2xl flex flex-col items-center">
                  <div className="relative w-full aspect-square max-h-[320px] flex items-center justify-center">
                    <AudioVisualizer isSpeaking={aiSpeaking} audioLevel={audioLevel} />
                  </div>
                  <p className="text-sm font-medium text-white mt-4">AI Interviewer</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {aiSpeaking ? 'Speaking...' : 'Listening...'}
                  </p>
                </div>
              </div>
              <Subtitles text={aiFullText || aiText} isSpeaking={aiSpeaking} wpm={aiSpeechWpm || 180} />
              <div className="absolute left-1/2 -translate-x-1/2 text-center w-full max-w-[600px] px-4 pointer-events-none z-10" style={{ bottom: 'calc(30% - 3rem)' }}>
                {(transcriptFinal || transcriptInterim) && (
                  <p className="text-sm text-cyan-500/90">
                    You: {transcriptFinal}
                    {transcriptInterim && <span className="opacity-70"> {transcriptInterim}</span>}
                  </p>
                )}
              </div>
              <div className="px-6 pb-32 max-w-3xl mx-auto w-full">
                <AnimatePresence>
                  {feedback && (
                    <motion.div {...fadeInUp}>
                      <FeedbackCard
                        feedback={typeof feedback === 'string' ? feedback : (feedback?.feedback ?? '')}
                        scores={typeof feedback === 'object' && feedback?.full?.scores ? feedback.full.scores : undefined}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase !== 'dsa' && (
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