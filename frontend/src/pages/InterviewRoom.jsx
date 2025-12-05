import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { PhoneOff, Mic, MicOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLiveKitInterview } from "../hooks/useLiveKitInterview";
import AIAvatar from "../components/AIAvatar";
import CandidateWebcam from "../components/CandidateWebcam";
import CodeEditor from "../components/CodeEditor";
import DSAQuestionDisplay from "../components/DSAQuestionDisplay";

const InterviewRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // State
  const [hasStarted, setHasStarted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [phase, setPhase] = useState('behavioral'); // 'behavioral' | 'dsa'
  const [currentQuestion, setCurrentQuestion] = useState(null);
  
  // LiveKit Connection
  // FIX: Passed sessionId directly so connection starts immediately on load
  const {
    connected,
    agentSpeaking,
    userTranscript,
    agentTranscript,
    error,
    disconnect,
    toggleMicrophone
  } = useLiveKitInterview(
    sessionId, 
    currentUser?.uid, 
    currentUser?.displayName || "Candidate"
  );

  // Update current question from agent transcript
  useEffect(() => {
    if (agentTranscript) {
      setCurrentQuestion(agentTranscript);
    }
  }, [agentTranscript]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(`Connection error: ${error}`);
    }
  }, [error]);

  const handleStartInterview = () => {
    setHasStarted(true);
    toast.success("🎤 Interview started - Speak naturally!");
  };

  const handleToggleMic = async () => {
    const newState = !micEnabled;
    await toggleMicrophone(newState);
    setMicEnabled(newState);
    toast.success(newState ? "🎤 Microphone enabled" : "🔇 Microphone muted");
  };

  const handleEndInterview = async () => {
    if (window.confirm("Are you sure you want to end the interview?")) {
      await disconnect();
      toast.success("Interview ended");
      navigate('/dashboard');
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
          {/* Animated Icon */}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto flex items-center justify-center shadow-lg"
          >
            <span className="text-6xl">🎙️</span>
          </motion.div>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-bold text-white mb-3">Ready to Begin?</h1>
            <p className="text-gray-400 text-lg">Your AI interviewer is waiting.</p>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2 text-sm">
            {connected ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400">Connected to LiveKit</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-yellow-400">Connecting...</span>
              </>
            )}
          </div>

          {/* Start Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStartInterview}
            disabled={!connected}
            className="w-full py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-2xl font-bold text-xl shadow-2xl transition-all disabled:cursor-not-allowed"
          >
            {connected ? "🚀 Start Interview" : "⏳ Connecting..."}
          </motion.button>

          {/* Tips */}
          <div className="text-left bg-gray-900/50 p-4 rounded-xl text-sm text-gray-300">
            <p className="font-semibold mb-2">💡 Tips:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Speak naturally - AI detects when you're done</li>
              <li>You can interrupt the AI anytime</li>
              <li>Microphone access required</li>
            </ul>
          </div>
        </motion.div>
      </div>
    );
  }

  // MAIN INTERVIEW SCREEN
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden text-white">
      
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-medium text-sm text-gray-300">
              {connected ? 'LIVE' : 'RECONNECTING...'}
            </span>
          </div>

          {/* Session ID */}
          <span className="text-xs text-gray-500">
            Session: {sessionId.slice(0, 8)}
          </span>
        </div>

        {/* End Interview Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleEndInterview}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-400 transition"
        >
          <PhoneOff size={18} />
          <span className="text-sm font-medium">End</span>
        </motion.button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        
        {phase === 'dsa' ? (
          // DSA Coding Phase
          <div className="w-full h-full flex gap-4">
            <div className="flex-1">
              <DSAQuestionDisplay question={currentQuestion} />
            </div>
            <div className="flex-1">
              <CodeEditor sessionId={sessionId} question={currentQuestion} />
            </div>
          </div>
        ) : (
          // Behavioral Interview Phase
          <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-center space-y-8">
            
            {/* AI Avatar */}
            <AIAvatar isSpeaking={agentSpeaking} currentQuestion={currentQuestion} />

            {/* Live Transcripts */}
            <div className="w-full space-y-3">
              <AnimatePresence mode="wait">
                {/* User Transcript */}
                {userTranscript && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-blue-500/10 border border-blue-500/30 backdrop-blur-md px-6 py-4 rounded-2xl"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-blue-400 uppercase mt-1">You</span>
                      <p className="flex-1 text-sm text-blue-100">{userTranscript}</p>
                    </div>
                  </motion.div>
                )}

                {/* Agent Transcript */}
                {agentTranscript && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-purple-500/10 border border-purple-500/30 backdrop-blur-md px-6 py-4 rounded-2xl"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-purple-400 uppercase mt-1">AI</span>
                      <p className="flex-1 text-sm text-purple-100">
                        {agentTranscript.slice(-200)}...
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-28 bg-black/40 backdrop-blur-md border-t border-white/10 flex items-center justify-center gap-12 relative">
        
        {/* Webcam Preview (Bottom Left) */}
        <div className="absolute left-6 bottom-6 w-56 h-40 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
          <CandidateWebcam />
        </div>

        {/* Microphone Button (Center) */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleToggleMic}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all border-4 ${
            micEnabled
              ? 'bg-blue-600 hover:bg-blue-500 border-blue-400/50'
              : 'bg-red-500 hover:bg-red-600 border-red-400/50'
          }`}
        >
          {micEnabled ? (
            <Mic className="w-9 h-9 text-white" />
          ) : (
            <MicOff className="w-9 h-9 text-white" />
          )}
        </motion.button>

        {/* Status Text (Bottom Right) */}
        <div className="absolute right-8 bottom-8 text-sm">
          {agentSpeaking ? (
            <div className="flex items-center gap-2 text-purple-400">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              <span className="font-medium">AI is speaking...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-medium">Listening...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;