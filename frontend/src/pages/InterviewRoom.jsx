import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { useInterviewWebSocket } from "../hooks/useInterviewWebSocket";
import AIAvatar from "../components/AIAvatar";
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


// WebSocket-based interview content (fallback/alt transport)
const InterviewRoomWSContent = ({ sessionId, onBack }) => {
  const {
    connected,
    error,
    currentQuestion,
    phase,
    transcriptInterim,
    transcriptFinal,
    aiText,
    aiSpeaking,
    feedback,
    isRecording,
    micEnabled,
    startRecording,
    stopRecording,
    submitAnswer,
    toggleMicrophone,
    skipQuestion,
    endInterview
  } = useInterviewWebSocket(sessionId);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleEndInterview = async () => {
    endInterview();
    setTimeout(() => onBack(), 3000);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden text-white">
      <header className="px-6 py-4 flex justify-between items-center bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-medium text-sm text-gray-300">
              {connected ? 'LIVE (WebSocket)' : 'CONNECTING...'}
            </span>
          </div>
          <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs font-medium text-purple-300">
            {phase === 'dsa' ? '💻 Coding Phase' : '🗣️ Behavioral Phase'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={skipQuestion} className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400">Skip</button>
          <button onClick={handleEndInterview} className="px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">End</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {phase === 'dsa' ? (
          <div className="w-full max-w-6xl flex-1 flex gap-4">
            <div className="flex-1 overflow-y-auto">
              <DSAQuestionDisplay question={currentQuestion} />
            </div>
            <div className="flex-1 min-h-[520px]">
              <CodeEditor sessionId={sessionId} question={currentQuestion} />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-center space-y-8">
            <AIAvatar isSpeaking={aiSpeaking} currentQuestion={currentQuestion} />

            {aiText && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl bg-white/5 border border-white/10 backdrop-blur-md px-6 py-4 rounded-2xl"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-purple-300 uppercase mt-1">AI</span>
                  <p className="flex-1 text-sm text-gray-100">{aiText}</p>
                </div>
              </motion.div>
            )}

            {(transcriptFinal || transcriptInterim) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl bg-blue-500/10 border border-blue-500/30 backdrop-blur-md px-6 py-4 rounded-2xl"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-blue-400 uppercase mt-1">You</span>
                  <p className="flex-1 text-sm text-blue-100">
                    {transcriptFinal}
                    {transcriptInterim ? <span className="opacity-80"> {transcriptInterim}</span> : null}
                  </p>
                </div>
              </motion.div>
            )}

            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl bg-green-500/10 border border-green-500/30 backdrop-blur-md px-6 py-4 rounded-2xl"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-green-400 uppercase mt-1">Feedback</span>
                  <p className="flex-1 text-sm text-green-100 whitespace-pre-wrap">{feedback}</p>
                </div>
              </motion.div>
            )}

            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button onClick={startRecording} className="px-6 py-3 bg-cyan-600 rounded-xl">Start Talking</button>
              ) : (
                <button onClick={stopRecording} className="px-6 py-3 bg-gray-600 rounded-xl">Pause</button>
              )}

              <button
                onClick={submitAnswer}
                disabled={aiSpeaking}
                className={`px-6 py-3 rounded-xl ${aiSpeaking ? 'bg-gray-700 text-gray-400' : 'bg-green-600 text-white'}`}
                title={aiSpeaking ? 'Wait for AI to finish speaking' : 'Submit answer and continue'}
              >
                I'm done
              </button>

              <button onClick={() => toggleMicrophone(!micEnabled)} className="px-4 py-3 bg-gray-700 rounded-xl">
                {micEnabled ? 'Mute' : 'Unmute'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default InterviewRoom;