import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Mic, MicOff, Send, SkipForward, LogOut, Code } from "lucide-react";

import { useInterviewWebSocket } from "../hooks/useInterviewWebSocket";
import AudioVisualizer from "../components/AudioVisualizer";
import Subtitles from "../components/Subtitles";
import CodeEditor from "../components/CodeEditor";
import DSAQuestionDisplay from "../components/DSAQuestionDisplay";

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
    endInterview,
    audioLevel
  } = useInterviewWebSocket(sessionId);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleEndInterview = async () => {
    if (window.confirm("Are you sure you want to end the interview?")) {
      endInterview();
      setTimeout(() => onBack(), 2000);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-black via-gray-900 to-black overflow-hidden">
      {/* Header */}
      <header className="relative z-10 px-6 py-4 bg-black/80 backdrop-blur-md border-b border-cyan-600/20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Left: Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-cyan-400 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-gray-300">
                {connected ? 'CONNECTED' : 'CONNECTING...'}
              </span>
            </div>
            
            <div className="h-6 w-px bg-cyan-600/30" />
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              {phase === 'dsa' ? <Code className="w-4 h-4 text-cyan-400" /> : <Mic className="w-4 h-4 text-cyan-400" />}
              <span className="text-sm font-medium text-cyan-400">
                {phase === 'dsa' ? 'Coding Phase' : 'Interview Phase'}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={skipQuestion}
              className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 hover:bg-yellow-500/20 transition text-sm font-medium flex items-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              Skip
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEndInterview}
              className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition text-sm font-medium flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              End Interview
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {phase === 'dsa' ? (
          // DSA Mode: Split view with question and code editor
          <div className="h-full p-6">
            <div className="max-w-7xl mx-auto h-full flex gap-6">
              {/* Question Panel */}
              <div className="w-1/2 overflow-y-auto custom-scrollbar">
                <DSAQuestionDisplay question={currentQuestion} />
              </div>
              
              {/* Code Editor Panel */}
              <div className="w-1/2 overflow-hidden">
                <CodeEditor sessionId={sessionId} question={currentQuestion} />
              </div>
            </div>
          </div>
        ) : (
          // Interview Mode: Visualizer + Transcript
          <div className="h-full flex flex-col">
            {/* Visualizer Section */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-3xl">
                {/* 3D Audio Visualizer */}
                <div className="relative h-[400px] rounded-2xl overflow-hidden border border-cyan-600/20 bg-black/40 backdrop-blur-sm">
                  <AudioVisualizer 
                    isSpeaking={aiSpeaking} 
                    audioLevel={audioLevel}
                  />
                  
                  {/* Status Badge */}
                  <div className="absolute top-4 left-4 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-cyan-500/30">
                    <span className="text-sm font-medium text-cyan-400">
                      {aiSpeaking ? '🗣️ AI Speaking...' : '👂 Listening...'}
                    </span>
                  </div>
                </div>

                {/* AI Label */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mt-4"
                >
                  <h2 className="text-xl font-bold text-white">AI Interviewer</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {aiSpeaking ? 'Speaking now...' : isRecording ? 'Recording your response...' : 'Ready to listen'}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Transcript Section */}
            <div className="px-6 pb-6 space-y-4 max-w-5xl mx-auto w-full">
              {/* AI Subtitles */}
              <AnimatePresence>
                {(aiFullText || aiText) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <Subtitles 
                      text={aiFullText || aiText} 
                      isSpeaking={aiSpeaking} 
                      wpm={aiSpeechWpm || 180}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* User Transcript */}
              <AnimatePresence>
                {(transcriptFinal || transcriptInterim) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-blue-500/10 border border-blue-500/30 backdrop-blur-md px-6 py-4 rounded-2xl"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-blue-400 uppercase mt-1">You</span>
                      <p className="flex-1 text-sm text-blue-100 leading-relaxed">
                        {transcriptFinal}
                        {transcriptInterim && <span className="opacity-60"> {transcriptInterim}</span>}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Feedback */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-green-500/10 border border-green-500/30 backdrop-blur-md px-6 py-4 rounded-2xl"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-green-400 uppercase mt-1">Feedback</span>
                      <p className="flex-1 text-sm text-green-100 whitespace-pre-wrap">{feedback}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar - Only show in interview mode */}
      {phase !== 'dsa' && (
        <div className="relative z-10 px-6 py-4 bg-black/80 backdrop-blur-md border-t border-cyan-600/20">
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-4">
            {/* Mic Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleMicrophone(!micEnabled)}
              className={`p-4 rounded-xl border-2 transition ${
                micEnabled
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                  : 'bg-gray-700/50 border-gray-600 text-gray-400'
              }`}
            >
              {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </motion.button>

            {/* Record/Pause */}
            {!isRecording ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startRecording}
                disabled={!micEnabled || aiSpeaking}
                className="px-8 py-4 bg-cyan-600 rounded-xl text-white font-medium hover:bg-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Talking
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={stopRecording}
                className="px-8 py-4 bg-gray-600 rounded-xl text-white font-medium hover:bg-gray-500 transition"
              >
                Pause
              </motion.button>
            )}

            {/* Submit Answer */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={submitAnswer}
              disabled={aiSpeaking}
              className={`px-8 py-4 rounded-xl font-medium transition flex items-center gap-2 ${
                aiSpeaking
                  ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
              title={aiSpeaking ? 'Wait for AI to finish speaking' : 'Submit your answer'}
            >
              <Send className="w-5 h-5" />
              I'm Done
            </motion.button>
          </div>

          {/* Audio Level Indicator */}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 max-w-3xl mx-auto"
            >
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-cyan-400"
                  style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Custom CSS for scrollbar */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.5);
        }
      `}</style>
    </div>
  );
};

export default InterviewRoom;