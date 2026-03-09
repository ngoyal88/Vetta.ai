import { useState, useEffect, useCallback } from 'react';
import { useRoomContext, useVoiceAssistant } from '@livekit/components-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

/**
 * LiveKit-powered interview hook (voice assistant, room context).
 */
export const useInterviewLiveKit = (sessionId) => {
  const room = useRoomContext();
  const assistant = useVoiceAssistant();

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [phase, setPhase] = useState('greeting');
  const [feedback, setFeedback] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * Monitor connection state
   */
  useEffect(() => {
    if (room) {
      const onConnected = () => {
        console.log('✅ Connected to LiveKit room');
        setConnected(true);
        setError(null);
        toast.success('Connected to interview');
      };
      
      const onDisconnected = () => {
        console.log('📴 Disconnected from LiveKit room');
        setConnected(false);
      };
      
      const onReconnecting = () => {
        console.log('🔄 Reconnecting...');
        toast.loading('Reconnecting...');
      };
      
      const onReconnected = () => {
        console.log('✅ Reconnected');
        toast.success('Reconnected');
      };
      
      room.on('connected', onConnected);
      room.on('disconnected', onDisconnected);
      room.on('reconnecting', onReconnecting);
      room.on('reconnected', onReconnected);
      
      return () => {
        room.off('connected', onConnected);
        room.off('disconnected', onDisconnected);
        room.off('reconnecting', onReconnecting);
        room.off('reconnected', onReconnected);
      };
    }
  }, [room]);
  
  /**
   * Monitor assistant state
   */
  useEffect(() => {
    if (assistant) {
      // Track when AI is speaking
      setIsAISpeaking(assistant.state === 'speaking');
      
      // Listen for transcripts
      const handleTranscript = (transcript, final) => {
        if (transcript && transcript.text) {
          setTranscript(transcript.text);
          
          // Clear transcript after final
          if (final) {
            setTimeout(() => setTranscript(''), 3000);
          }
        }
      };
      
      // Subscribe to transcript events
      if (assistant.on) {
        assistant.on('transcript', handleTranscript);
        return () => assistant.off('transcript', handleTranscript);
      }
    }
  }, [assistant]);
  
  /**
   * Monitor data messages for questions and feedback
   */
  useEffect(() => {
    if (!room) return;
    
    const handleDataReceived = (payload, participant) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const message = JSON.parse(text);
        
        console.log('📨 Data message received:', message.type);
        
        switch (message.type) {
          case 'question':
            setCurrentQuestion(message.question);
            setPhase(message.phase || 'behavioral');
            break;
            
          case 'phase_change':
            setPhase(message.phase);
            if (message.phase === 'dsa') {
              toast.success('🖥️ Switching to coding challenge!', { duration: 3000 });
            }
            break;
            
          case 'feedback':
            setFeedback(message.feedback);
            toast.success('Interview completed!');
            break;
            
          case 'error':
            setError(message.message);
            toast.error(`Error: ${message.message}`);
            break;
            
          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (err) {
        console.error('Failed to parse data message:', err);
      }
    };
    
    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room]);
  
  /**
   * Send data message to room
   */
  const sendMessage = useCallback((message) => {
    if (room && room.localParticipant) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(message));
        room.localParticipant.publishData(data, { reliable: true });
        console.log('📤 Sent message:', message.type);
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    }
  }, [room]);
  
  /**
   * Start the interview
   */
  const startInterview = useCallback(() => {
    sendMessage({ type: 'start' });
  }, [sendMessage]);
  
  /**
   * Skip current question
   */
  const skipQuestion = useCallback(() => {
    sendMessage({ type: 'skip_question' });
    toast.success('Skipping question...');
  }, [sendMessage]);
  
  /**
   * End the interview
   */
  const endInterview = useCallback(async () => {
    if (window.confirm('Are you sure you want to end the interview?')) {
      sendMessage({ type: 'end_interview' });
      
      // Wait for feedback then disconnect
      setTimeout(() => {
        if (room) {
          room.disconnect();
        }
      }, 5000);
    }
  }, [sendMessage, room]);
  
  /**
   * Submit code for DSA questions
   */
  const submitCode = useCallback(async (questionId, language, code) => {
    try {
      const result = await api.submitCode(sessionId, questionId, language, code);
      
      if (result.passed) {
        toast.success(`✅ All tests passed! (${result.tests_passed}/${result.total_tests})`);
      } else {
        toast.error(`❌ ${result.tests_passed}/${result.total_tests} tests passed`);
      }
      
      return result;
    } catch (err) {
      toast.error('Code execution failed');
      throw err;
    }
  }, [sessionId]);
  
  return {
    // Connection state
    connected,
    error,
    
    // Interview state
    currentQuestion,
    phase,
    transcript,
    isAISpeaking,
    feedback,
    
    // Assistant controls
    isListening: assistant?.state === 'listening',
    isThinking: assistant?.state === 'thinking',
    
    // Actions
    startInterview,
    skipQuestion,
    endInterview,
    submitCode,
    sendMessage
  };
};