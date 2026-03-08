import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

import { useConfirmDialog } from "../context/ConfirmDialogContext";
import { useInterviewWebSocket } from "../hooks/useInterviewWebSocket";
import AudioVisualizer from "../components/AudioVisualizer";
import Subtitles from "../components/Subtitles";
import CodeEditor from "../components/CodeEditor";
import DSAQuestionDisplay from "../components/DSAQuestionDisplay";
import InterviewRoomHeader from "../components/InterviewRoomHeader";
import VoiceControlBar from "../components/VoiceControlBar";
import TranscriptBlock from "../components/TranscriptBlock";
import FeedbackCard from "../components/FeedbackCard";
import DSASplitLayout from "../components/DSASplitLayout";
import { fadeInUp, slidePhase } from "../utils/animations";

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

  // Post-interview view: scrollable feedback + sticky "Back to Dashboard" so user is never stuck
  if (interviewEnded) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-black via-gray-900 to-black overflow-hidden">
        {errorAnnouncer}
        {/* Scrollable content: title + feedback (or loading state) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full">
            <h1 className="text-2xl font-bold text-white mb-2">Thank you for completing the interview</h1>
            <p className="text-gray-400 mb-6">
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
                <p className="text-gray-500 text-sm">This may take a moment.</p>
              </div>
            )}
          </div>
        </div>
        {/* Sticky footer: primary CTA always visible so user can always go back */}
        <footer className="flex-shrink-0 p-6 border-t border-gray-800/80 bg-black/40">
          <div className="max-w-3xl mx-auto w-full">
            <button
              type="button"
              onClick={handleBackAfterFeedback}
              className="w-full py-3 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              {feedback ? 'Back to Dashboard' : 'Back to Dashboard without waiting'}
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-black via-gray-900 to-black overflow-hidden">
      {errorAnnouncer}
      <InterviewRoomHeader
        connected={connected}
        phase={phase}
        onSkip={phase === 'dsa' ? requestNextDSAQuestion : skipQuestion}
        onEndInterview={handleEndInterview}
        loadingNextProblem={loadingNextProblem}
        timer={phase === 'dsa' ? formatTimer(elapsedSeconds) : null}
        difficulty={currentQuestion?.difficulty || null}
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
                        <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 animate-pulse space-y-4 h-full">
                          <div className="flex justify-between items-center">
                            <div className="h-6 bg-gray-700 rounded w-2/3" />
                            <div className="h-5 bg-gray-700 rounded w-16" />
                          </div>
                          <div className="space-y-2">
                            <div className="h-4 bg-gray-700 rounded w-full" />
                            <div className="h-4 bg-gray-700 rounded w-5/6" />
                            <div className="h-4 bg-gray-700 rounded w-4/6" />
                          </div>
                          <div className="h-4 bg-gray-700 rounded w-1/3 mt-4" />
                          <div className="space-y-2">
                            <div className="h-3 bg-gray-700 rounded w-full" />
                            <div className="h-3 bg-gray-700 rounded w-3/4" />
                          </div>
                          <p className="text-xs text-gray-500 pt-2">
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
              <div className="flex-1 flex items-center justify-center p-6 min-h-0">
                <div className="w-full max-w-3xl">
                  <div className="relative h-[400px] rounded-2xl overflow-hidden border border-cyan-600/20 bg-black/40 backdrop-blur-sm shadow-inner">
                    <AudioVisualizer isSpeaking={aiSpeaking} audioLevel={audioLevel} />
                    <div className="absolute top-4 left-4 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-cyan-500/30">
                      <span className="text-sm font-medium text-cyan-400">
                        {aiSpeaking ? 'AI Speaking...' : 'Listening...'}
                      </span>
                    </div>
                  </div>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-4">
                    <h2 className="text-xl font-bold text-white">AI Interviewer</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {aiSpeaking ? 'Speaking now...' : isRecording ? 'Recording your response...' : 'Ready to listen'}
                    </p>
                  </motion.div>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-4 max-w-5xl mx-auto w-full">
                <AnimatePresence>
                  {(aiFullText || aiText) && (
                    <motion.div {...fadeInUp}>
                      <Subtitles text={aiFullText || aiText} isSpeaking={aiSpeaking} wpm={aiSpeechWpm || 180} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {(transcriptFinal || transcriptInterim) && (
                    <motion.div {...fadeInUp}>
                      <TranscriptBlock label="You" text={transcriptFinal} interim={transcriptInterim} className="bg-blue-500/10 border-blue-500/30 text-blue-100" />
                    </motion.div>
                  )}
                </AnimatePresence>
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