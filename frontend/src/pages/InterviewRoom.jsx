import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { PhoneOff, Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import AIAvatar from "../components/AIAvatar";
import LiveTranscription from "../components/LiveTranscription";
import CandidateWebcam from "../components/CandidateWebcam";
import CodeEditor from "../components/CodeEditor";
import DSAQuestionDisplay from "../components/DSAQuestionDisplay";
import MicInput from "../components/MicInput"; // ✅ Import the new component

const InterviewRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // State
  const [hasStarted, setHasStarted] = useState(false); // ✅ Prevents immediate start
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [phase, setPhase] = useState('behavioral');
  
  // Audio Playback State (Kokoro Queue)
  const audioQueueRef = useRef([]);
  const audioPlayerRef = useRef(new Audio());
  const isPlayingRef = useRef(false);

  // WebSocket Connection
  const { connected, messages, sendMessage } = useWebSocket(sessionId);
  
  // Audio Recorder (Now provides 'stream' for the visualizer)
  const { isRecording, startRecording, stopRecording, stream } = useAudioRecorder((audioBase64) => {
    sendMessage({
      type: 'audio_chunk',
      audio: audioBase64,
      speaker: 'candidate'
    });
  });

  // --- AUDIO HANDLING (No Lag Playback) ---
  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0) {
      setIsSpeaking(false);
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const base64Audio = audioQueueRef.current.shift();
    audioPlayerRef.current.src = `data:audio/wav;base64,${base64Audio}`;
    
    audioPlayerRef.current.play().catch(e => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        isPlayingRef.current = false;
    });

    audioPlayerRef.current.onended = playNextAudio;
  };

  const queueAudio = (base64Audio) => {
    audioQueueRef.current.push(base64Audio);
    if (!isPlayingRef.current) {
      playNextAudio();
    }
  };

  const stopAudioPlayback = () => {
    // Interruption Logic: Stop AI when user speaks
    audioPlayerRef.current.pause();
    audioPlayerRef.current.currentTime = 0;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
  };

  // --- WEBSOCKET HANDLERS ---
  useEffect(() => {
    if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        
        switch (lastMsg.type) {
            case 'transcription':
                // Update live transcript
                setTranscriptions(prev => [...prev, {
                    speaker: lastMsg.speaker,
                    text: lastMsg.text,
                    timestamp: lastMsg.timestamp
                }]);
                if (lastMsg.speaker === 'candidate') {
                    setCurrentAnswer(prev => prev + " " + lastMsg.text);
                }
                break;

            case 'ai_response':
            case 'question':
                // Update Question Text & Play Audio
                const qText = lastMsg.question?.question || lastMsg.question || lastMsg.text;
                setCurrentQuestion(qText);
                
                if (lastMsg.audio) {
                    queueAudio(lastMsg.audio);
                }
                break;
            default: break;
        }
    }
  }, [messages]);

  // --- ACTIONS ---
  const handleStartInterview = () => {
    setHasStarted(true);
    sendMessage({ type: "start_interview" }); // Tells backend to say "Hello"
    
    // Wake up audio engine (mobile/browser safety)
    const silent = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==");
    silent.play().catch(() => {});
  };

  const handleMicToggle = () => {
    if (isRecording) {
      // Stop recording -> Commit Answer
      stopRecording();
      sendMessage({ type: "answer_commit", text: currentAnswer });
      setCurrentAnswer(""); 
    } else {
      // Start recording -> Interrupt AI
      stopAudioPlayback();
      startRecording();
    }
  };

  const handleEndInterview = async () => {
    if (window.confirm("End interview?")) {
        stopRecording();
        navigate('/dashboard');
    }
  };

  // --- RENDER ---
  
  // 1. START SCREEN (Fixes Immediate Start Issue)
  if (!hasStarted) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="text-center space-y-8 max-w-lg bg-gray-800 p-10 rounded-3xl border border-gray-700 shadow-2xl">
          <div className="w-32 h-32 bg-blue-600/20 rounded-full mx-auto flex items-center justify-center animate-pulse">
            <span className="text-5xl">🎙️</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Ready?</h1>
            <p className="text-gray-400">Your AI interviewer is connected.</p>
          </div>
          <button 
            onClick={handleStartInterview}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-xl transition-transform transform hover:scale-105"
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  // 2. MAIN INTERFACE
  return (
    <div className="h-screen flex flex-col bg-gray-900 overflow-hidden text-white">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center bg-black/20 border-b border-white/5">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
            <span className="font-medium text-sm opacity-80">
                {connected ? 'LIVE' : 'RECONNECTING...'}
            </span>
        </div>
        <button onClick={handleEndInterview} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400">
            <PhoneOff size={20} />
        </button>
      </header>

      {/* Main Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {phase === 'dsa' ? (
            <div className="w-full h-full flex gap-4">
                <DSAQuestionDisplay question={currentQuestion} />
                <CodeEditor />
            </div>
        ) : (
            <div className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center mb-20">
                <AIAvatar isSpeaking={isSpeaking} currentQuestion={currentQuestion} />
                
                {/* Live Subtitles */}
                <div className="absolute bottom-32 text-center pointer-events-none">
                    <AnimatePresence>
                        {currentAnswer && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="inline-block bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl text-lg font-medium text-blue-100"
                            >
                                "{currentAnswer}"
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-24 bg-black/30 backdrop-blur-md border-t border-white/5 flex items-center justify-center gap-8 relative z-50">
        <div className="absolute left-6 bottom-6 w-48 h-36 rounded-xl overflow-hidden border-2 border-white/10 shadow-2xl bg-black">
            <CandidateWebcam />
        </div>

        {/* ✅ NEW MIC INPUT with Visualizer */}
        <MicInput 
            isRecording={isRecording}
            onStart={handleMicToggle}
            onStop={handleMicToggle}
            stream={stream}
            disabled={!connected}
        />

        <button 
            onClick={() => sendMessage({ type: "answer_commit", text: currentAnswer })}
            disabled={!currentAnswer.trim()}
            className="absolute right-8 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
        >
            <Send size={18} />
            <span>Send</span>
        </button>
      </div>
    </div>
  );
};

export default InterviewRoom;