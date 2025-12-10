// frontend/src/pages/InterviewRoom.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { PhoneOff, Mic, MicOff, SkipForward } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useInterviewWebSocket } from "../hooks/useInterviewWebSocket";
import AIAvatar from "../components/AIAvatar";
import CandidateWebcam from "../components/CandidateWebcam";
import CodeEditor from "../components/CodeEditor";
import DSAQuestionDisplay from "../components/DSAQuestionDisplay";

const InterviewRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [hasStarted, setHasStarted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  
  const {
    connected,
    status,
    error,
    currentQuestion,
    phase,
    transcript,
    aiSpeaking,
    feedback,
    isRecording,
    micEnabled,
    startRecording,
    stopRecording,
    toggleMicrophone,
    skipQuestion,
    endInterview,
    disconnect
  } = useInterviewWebSocket(sessionId);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Show feedback when received
  useEffect(() => {
    if (feedback) {
      setShowFeedback(true);
    }
  }, [feedback]);

  // Handle voice activation (hold to talk)
  const handleMouseDown = () => {
    if (connected && micEnabled && !aiSpeaking && !isRecording) {
      startRecording();
    }
  };

  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  // Handle toggle mic
  const handleToggleMic = async () => {
    await toggleMicrophone(!micEnabled);
  };

  // Handle end interview
  const handleEndInterview = async () => {
    if (window.confirm("Are you sure you want to end the interview?")) {
      endInterview();
      setTimeout(() => {
        disconnect();
        navigate('/dashboard');
      }, 5000);
    }
  };

  // START SCREEN
  if (!hasStarted) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-8 max-w-lg bg-gray-800/50 backdrop-blur-xl p-12 rounded-3xl border border-gray-700/50 shadow-2xl"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto flex items-center justify-center shadow-lg"
          >
            <span className="text-6xl">🎙️</span>
          </motion.div>

          <div>
            <h1 className="text-4xl font-bold text-white mb-3">Ready to Begin?</h1>
            <p className="text-gray-400 text-lg">Your AI interviewer is waiting.</p>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm">
            {connected ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400">Connected</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-yellow-400">Connecting...</span>
              </>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setHasStarted(true)}
            disabled={!connected}
            className="w-full py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-2xl font-bold text-xl shadow-2xl transition-all disabled:cursor-not-allowed"
          >
            {connected ? "🚀 Start Interview" : "⏳ Connecting..."}
          </motion.button>

          <div className="text-left bg-gray-900/50 p-4 rounded-xl text-sm text-gray-300">
            <p className="font-semibold mb-2">💡 How to use:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Hold the mic button to speak</li>
              <li>Release when you're done answering</li>
              <li>Wait for AI to respond</li>
            </ul>
          </div>
        </motion.div>
      </div>
    );
  }

  // FEEDBACK SCREEN
  if (showFeedback && feedback) {
    return (
      <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50"
          >
            <h1 className="text-4xl font-bold text-white mb-6 text-center">
              🎉 Interview Complete!
            </h1>
            
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-gray-300 leading-relaxed">
                {feedback.feedback || JSON.stringify(feedback, null, 2)}
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition"
              >
                Back to Dashboard
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // MAIN INTERVIEW SCREEN
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden text-white">
      
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-medium text-sm text-gray-300">
              {connected ? 'LIVE' : 'RECONNECTING...'}
            </span>
          </div>

          <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs font-medium text-purple-300">
            {phase === 'dsa' ? '💻 Coding Phase' : '🗣️ Behavioral Phase'}
          </div>

          <span className="text-xs text-gray-500">Status: {status}</span>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={skipQuestion}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded-lg text-yellow-400 transition"
          >
            <SkipForward size={18} />
            <span className="text-sm font-medium">Skip</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleEndInterview}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-400 transition"
          >
            <PhoneOff size={18} />
            <span className="text-sm font-medium">End</span>
          </motion.button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        
        {phase === 'dsa' ? (
          <div className="w-full h-full flex gap-4">
            <div className="flex-1 overflow-y-auto">
              <DSAQuestionDisplay question={currentQuestion} />
            </div>
            <div className="flex-1">
              <CodeEditor sessionId={sessionId} question={currentQuestion} />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-center space-y-8">
            
            <AIAvatar isSpeaking={aiSpeaking} currentQuestion={currentQuestion} />

            {/* Live Transcript */}
            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl bg-blue-500/10 border border-blue-500/30 backdrop-blur-md px-6 py-4 rounded-2xl"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-blue-400 uppercase mt-1">You</span>
                  <p className="flex-1 text-sm text-blue-100">{transcript}</p>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-28 bg-black/40 backdrop-blur-md border-t border-white/10 flex items-center justify-center gap-12 relative">
        
        {/* Webcam */}
        <div className="absolute left-6 bottom-6 w-56 h-40 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
          <CandidateWebcam />
        </div>

        {/* Mic Button (Hold to Talk) */}
        <motion.button
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          disabled={!micEnabled || aiSpeaking}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all border-4 ${
            isRecording
              ? 'bg-red-600 border-red-400/50 animate-pulse'
              : micEnabled && !aiSpeaking
              ? 'bg-blue-600 hover:bg-blue-500 border-blue-400/50'
              : 'bg-gray-600 border-gray-400/50 cursor-not-allowed'
          }`}
        >
          {micEnabled ? (
            <Mic className="w-9 h-9 text-white" />
          ) : (
            <MicOff className="w-9 h-9 text-white" />
          )}
        </motion.button>

        {/* Mic Toggle */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleToggleMic}
          className="absolute right-32 bottom-8 w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 border-2 border-white/20 flex items-center justify-center transition"
        >
          {micEnabled ? (
            <Mic className="w-5 h-5 text-white" />
          ) : (
            <MicOff className="w-5 h-5 text-red-400" />
          )}
        </motion.button>

        {/* Status Indicator */}
        <div className="absolute right-8 bottom-8 text-sm">
          {aiSpeaking ? (
            <div className="flex items-center gap-2 text-purple-400">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              <span className="font-medium">AI is speaking...</span>
            </div>
          ) : isRecording ? (
            <div className="flex items-center gap-2 text-red-400">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-medium">Recording...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-medium">Hold mic to speak</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;