import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Mic, MicOff, PhoneOff, Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import AIAvatar from "../components/AIAvatar";
import LiveTranscription from "../components/LiveTranscription";
import CandidateWebcam from "../components/CandidateWebcam";
import CodeEditor from "../components/CodeEditor";
import DSAQuestionDisplay from "../components/DSAQuestionDisplay";

const InterviewRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const config = JSON.parse(localStorage.getItem('interviewConfig') || '{}');
  
  // State
  const [initialized, setInitialized] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [answerStartTime, setAnswerStartTime] = useState(null);
  const [phase, setPhase] = useState('behavioral'); // 'behavioral' | 'dsa'
  
  // WebSocket
  const { connected, messages, sendMessage } = useWebSocket(sessionId);
  
  // Audio Recording
  const { isRecording, startRecording, stopRecording } = useAudioRecorder((audioBase64) => {
    sendMessage({
      type: 'audio_chunk',
      audio: audioBase64,
      speaker: 'candidate'
    });
  });

  // Initialize interview
  useEffect(() => {
    if (!initialized && currentUser && config.sessionId) {
      api.startInterview(
        config.userId,
        config.interviewType,
        config.difficulty,
        config.resumeData,
        config.customRole
      )
        .then((data) => {
          setInitialized(true);
          setCurrentQuestion(data.question?.question || data.question);
          setAnswerStartTime(Date.now());
          toast.success("Interview started!");
          
          // Speak question
          speakQuestion(data.question?.question || data.question);
        })
        .catch((err) => {
          toast.error("Failed to start interview");
          console.error(err);
          navigate('/dashboard');
        });
    }
  }, [initialized, currentUser, config, navigate]);

  // Handle WebSocket messages
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.type === 'transcription') {
        setTranscriptions(prev => [...prev, {
          speaker: msg.speaker,
          text: msg.text,
          timestamp: msg.timestamp
        }]);
        
        if (msg.speaker === 'candidate') {
          setCurrentAnswer(prev => prev + " " + msg.text);
        }
      } else if (msg.type === 'question') {
        setCurrentQuestion(msg.question?.question || msg.question);
        speakQuestion(msg.question?.question || msg.question);
      }
    });
  }, [messages]);

  // Speak question using Web Speech API
  const speakQuestion = (text) => {
    if (!text) return;
    
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Toggle microphone
  const toggleMic = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
      if (!answerStartTime) {
        setAnswerStartTime(Date.now());
      }
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    const timeSpent = answerStartTime ? Math.floor((Date.now() - answerStartTime) / 1000) : 0;

    try {
      stopRecording();
      
      await api.submitResponse(
        sessionId,
        0, // question index - you can track this
        currentAnswer,
        timeSpent
      );
      
      toast.success("Answer submitted!");
      
      // Clear and get next question
      setCurrentAnswer("");
      setAnswerStartTime(Date.now());
      
      const nextData = await api.getNextQuestion(sessionId);
      if (nextData.should_end) {
        handleEndInterview();
      } else {
        setCurrentQuestion(nextData.question?.question || nextData.question);
        speakQuestion(nextData.question?.question || nextData.question);
      }
    } catch (err) {
      toast.error("Failed to submit answer");
      console.error(err);
    }
  };

  // End interview
  const handleEndInterview = async () => {
    if (!window.confirm("Are you sure you want to end the interview?")) {
      return;
    }

    try {
      stopRecording();
      const result = await api.completeInterview(sessionId);
      toast.success("Interview completed!");
      console.log("Feedback:", result.feedback);
      navigate('/dashboard');
    } catch (err) {
      toast.error("Failed to complete interview");
      console.error(err);
    }
  };

  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Initializing interview...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 overflow-hidden">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-black/30 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">AI Interview</h1>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            connected ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
          }`}>
            {connected ? '● Live' : '● Disconnected'}
          </span>
        </div>
        
        <button
          onClick={handleEndInterview}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition flex items-center gap-2"
        >
          <PhoneOff className="w-4 h-4" />
          End Interview
        </button>
      </motion.header>

      {/* Main Content */}
      {phase === 'dsa' ? (
        // DSA Mode: 3 Column Layout
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/4 border-r border-white/10 p-4">
            <CandidateWebcam />
          </div>
          <div className="w-1/3 border-r border-white/10 p-4 overflow-y-auto">
            <DSAQuestionDisplay question={currentQuestion} />
          </div>
          <div className="w-5/12 p-4">
            <CodeEditor sessionId={sessionId} question={currentQuestion} />
          </div>
        </div>
      ) : (
        // Video Call Mode
        <div className="flex-1 relative overflow-hidden">
          {/* AI Avatar Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <AIAvatar isSpeaking={isSpeaking} currentQuestion={currentQuestion} />
          </div>

          {/* Candidate Webcam (Mirror) - Bottom Right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-6 right-6 w-80 h-60 rounded-2xl overflow-hidden border-4 border-white/20 shadow-2xl"
          >
            <CandidateWebcam />
          </motion.div>

          {/* Live Transcription Subtitles */}
          <LiveTranscription transcriptions={transcriptions} />

          {/* Controls - Bottom Center */}
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4"
          >
            {/* Mic Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMic}
              className={`p-6 rounded-full shadow-2xl transition ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {isRecording ? (
                <MicOff className="w-8 h-8 text-white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </motion.button>

            {/* Submit Answer Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmitAnswer}
              disabled={!currentAnswer.trim()}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full font-bold shadow-2xl transition flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              Submit Answer
            </motion.button>
          </motion.div>

          {/* Timer - Top Right */}
          <div className="absolute top-6 right-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-white font-mono">
            {answerStartTime ? Math.floor((Date.now() - answerStartTime) / 1000) : 0}s
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewRoom;