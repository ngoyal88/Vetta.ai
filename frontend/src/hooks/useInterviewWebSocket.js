// frontend/src/hooks/useInterviewWebSocket.js
/**
 * Enhanced WebSocket hook with complete edge case handling
 * Handles: Echo prevention, interruptions, reconnection, network issues, VAD
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecorder, AudioPlayer, checkBrowserSupport } from '../utils/audioUtils';
import toast from 'react-hot-toast';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';

export const useInterviewWebSocket = (sessionId) => {
  // Connection state
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('disconnected');

  // Interview state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [phase, setPhase] = useState('behavioral');
  const [transcript, setTranscript] = useState('');
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);

  // Network state
  const [networkIssue, setNetworkIssue] = useState(false);
  const [messageQueue, setMessageQueue] = useState([]);

  // Refs
  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const audioLevelIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Constants
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const ACTIVITY_TIMEOUT = 300000; // 5 minutes
  const AUTO_STOP_SILENCE = 2000; // 2 seconds of silence

  /**
   * Check browser support on mount
   */
  useEffect(() => {
    const support = checkBrowserSupport();
    if (!support.supported) {
      const missing = Object.entries(support.features)
        .filter(([_, supported]) => !supported)
        .map(([feature]) => feature);

      setError(`Browser not supported. Missing: ${missing.join(', ')}`);
      toast.error('Browser not supported for voice interviews');
    }
  }, []);

  /**
   * Connect to WebSocket with error handling
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('⚠️ Already connected');
      return;
    }

    try {
      console.log('🔌 Connecting to WebSocket...');
      const ws = new WebSocket(`${WS_URL}/interview/${sessionId}`);
      wsRef.current = ws;

      // Connection opened
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnected(true);
        setStatus('connected');
        setError(null);
        setNetworkIssue(false);
        reconnectAttemptsRef.current = 0;

        // Start heartbeat
        startHeartbeat();

        // Send queued messages
        flushMessageQueue();

        toast.success('Connected to interview');
      };

      // Message received
      ws.onmessage = (event) => {
        lastActivityRef.current = Date.now();
        handleMessage(JSON.parse(event.data));
      };

      // Connection error
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setNetworkIssue(true);
        setError('Connection error');
      };

      // Connection closed
      ws.onclose = (event) => {
        console.log('📴 WebSocket closed:', event.code, event.reason);
        setConnected(false);
        setStatus('disconnected');
        stopHeartbeat();

        // Handle different close codes
        if (event.code === 1000) {
          // Normal closure
          console.log('✅ Connection closed normally');
        } else if (event.code === 1006) {
          // Abnormal closure
          setNetworkIssue(true);
          attemptReconnect();
        } else {
          attemptReconnect();
        }
      };

    } catch (err) {
      console.error('Failed to connect:', err);
      setError('Failed to connect');
      toast.error('Connection failed');
    }
  }, [sessionId]);

  /**
   * Attempt reconnection with exponential backoff
   */
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setError('Connection lost. Please refresh the page.');
      toast.error('Connection lost. Please refresh.');
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current - 1);

    console.log(`🔄 Reconnecting in ${delay}ms (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
    toast.loading(`Reconnecting... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  /**
   * Start heartbeat to keep connection alive
   */
  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping' });

        // Check for activity timeout
        const inactiveTime = Date.now() - lastActivityRef.current;
        if (inactiveTime > ACTIVITY_TIMEOUT) {
          console.warn('⚠️ Activity timeout detected');
          toast.warning('Are you still there?');
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * Handle incoming messages
   */
  const handleMessage = useCallback((message) => {
    console.log('📨 Message received:', message.type);

    switch (message.type) {
      case 'question':
        setCurrentQuestion(message.question);
        setPhase(message.phase);

        // Play audio
        if (message.audio && playerRef.current) {
          setAiSpeaking(true);

          // CRITICAL: Stop recording when AI speaks (prevent echo)
          if (isRecording && recorderRef.current) {
            recorderRef.current.pause();
            console.log('⏸️ Paused recording - AI speaking');
          }

          playerRef.current.play(message.audio, {
            onStart: () => {
              setAiSpeaking(true);
              console.log('🔊 AI started speaking');
            },
            onEnd: () => {
              setAiSpeaking(false);
              console.log('🔇 AI finished speaking');

              // Resume recording if was recording
              if (micEnabled && recorderRef.current) {
                recorderRef.current.resume();
                console.log('▶️ Resumed recording');
              }
            }
          });
        }

        toast.success('New question received');
        break;

      case 'transcript':
        setTranscript(message.text);

        // Clear transcript after final
        if (message.is_final) {
          setTimeout(() => setTranscript(''), 3000);
        }
        break;

      case 'status':
        setStatus(message.status);

        if (message.status === 'speaking') {
          setAiSpeaking(true);
        } else if (message.status === 'listening') {
          setAiSpeaking(false);
        }
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

      case 'pong':
        // Heartbeat response
        console.log('💓 Heartbeat received');
        break;

      case 'error':
        setError(message.message);
        toast.error(`Error: ${message.message}`);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }, [isRecording, micEnabled]);

  /**
   * Send message with queueing for offline support
   */
  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (err) {
        console.error('Failed to send message:', err);
        queueMessage(message);
      }
    } else {
      queueMessage(message);
    }
  }, []);

  /**
   * Queue message for later sending
   */
  const queueMessage = useCallback((message) => {
    setMessageQueue(prev => [...prev, message]);
    console.log('📦 Message queued:', message.type);
  }, []);

  /**
   * Flush queued messages
   */
  const flushMessageQueue = useCallback(() => {
    if (messageQueue.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      console.log(`📤 Flushing ${messageQueue.length} queued messages`);
      messageQueue.forEach(msg => {
        try {
          wsRef.current.send(JSON.stringify(msg));
        } catch (err) {
          console.error('Failed to send queued message:', err);
        }
      });
      setMessageQueue([]);
    }
  }, [messageQueue]);

  /**
   * Start recording with VAD and echo prevention
   */
  const startRecording = useCallback(async () => {
    if (!micEnabled || !connected || aiSpeaking) {
      if (aiSpeaking) {
        toast.error('Please wait for AI to finish speaking');
      }
      return;
    }

    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
      }

      await recorderRef.current.start(
        (audioChunk) => {
          // Send audio chunk to server
          if (wsRef.current?.readyState === WebSocket.OPEN && !aiSpeaking) {
            audioChunk.arrayBuffer().then((buffer) => {
              wsRef.current.send(buffer);
            });
          }
        },
        {
          enableVAD: true,
          silenceThreshold: 0.01,
          silenceDuration: AUTO_STOP_SILENCE,
          onSilenceDetected: () => {
            console.log('🤫 Auto-stopping due to silence');
            stopRecording();
          },
          onSpeechStart: () => {
            console.log('🗣️ Speech started');
          },
          onSpeechEnd: () => {
            console.log('🤐 Speech ended');
          }
        }
      );

      setIsRecording(true);

      // Send start_recording message
      sendMessage({ type: 'start_recording' });

      // Start audio level monitoring
      startAudioLevelMonitoring();

      console.log('🎤 Recording started');

    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error(error.message || 'Failed to start recording');
    }
  }, [micEnabled, connected, aiSpeaking, sendMessage]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !isRecording) return;

    try {
      await recorderRef.current.stop();
      setIsRecording(false);

      // Stop audio level monitoring
      stopAudioLevelMonitoring();

      // Send stop_recording message
      sendMessage({ type: 'stop_recording' });

      console.log('🛑 Recording stopped');

    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [isRecording, sendMessage]);

  /**
   * Start audio level monitoring for visualization
   */
  const startAudioLevelMonitoring = useCallback(() => {
    audioLevelIntervalRef.current = setInterval(() => {
      if (recorderRef.current) {
        const level = recorderRef.current.getAudioLevel();
        setAudioLevel(level);
      }
    }, 100);
  }, []);

  /**
   * Stop audio level monitoring
   */
  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  /**
   * Toggle microphone
   */
  const toggleMicrophone = useCallback(async (enabled) => {
    setMicEnabled(enabled);

    if (!enabled && isRecording) {
      await stopRecording();
    }

    toast.success(enabled ? '🎤 Microphone enabled' : '🔇 Microphone muted');
  }, [isRecording, stopRecording]);

  /**
   * Interrupt AI (stop AI speech and start recording)
   */
  const interruptAI = useCallback(() => {
    if (aiSpeaking && playerRef.current) {
      playerRef.current.stop();
      setAiSpeaking(false);
      sendMessage({ type: 'interrupt' });
      toast.info('AI interrupted');

      // Start recording after interruption
      if (micEnabled) {
        setTimeout(() => startRecording(), 200);
      }
    }
  }, [aiSpeaking, micEnabled, sendMessage, startRecording]);

  /**
   * Skip current question
   */
  const skipQuestion = useCallback(() => {
    sendMessage({ type: 'skip_question' });
    toast.success('Skipping question...');
  }, [sendMessage]);

  /**
   * End interview
   */
  const endInterview = useCallback(() => {
    sendMessage({ type: 'end_interview' });
  }, [sendMessage]);

  /**
   * Disconnect and cleanup
   */
  const disconnect = useCallback(() => {
    console.log('📴 Disconnecting...');

    // Stop recording
    if (recorderRef.current) {
      recorderRef.current.cleanup();
      recorderRef.current = null;
    }

    // Stop audio playback
    if (playerRef.current) {
      playerRef.current.stop();
    }

    // Stop monitoring
    stopAudioLevelMonitoring();
    stopHeartbeat();

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setConnected(false);
    setStatus('disconnected');
  }, [stopAudioLevelMonitoring, stopHeartbeat]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    if (!sessionId) return;

    // Initialize audio player
    playerRef.current = new AudioPlayer();

    // Set callbacks
    playerRef.current.onPlaybackStart = () => {
      setAiSpeaking(true);
    };

    playerRef.current.onPlaybackEnd = () => {
      setAiSpeaking(false);
    };

    // Connect to WebSocket
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  /**
   * Handle page visibility changes (pause when tab hidden)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🙈 Tab hidden, pausing');
        if (isRecording) {
          recorderRef.current?.pause();
        }
      } else {
        console.log('👀 Tab visible, resuming');
        if (isRecording && micEnabled) {
          recorderRef.current?.resume();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording, micEnabled]);

  /**
   * Handle network online/offline events
   */
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network online');
      setNetworkIssue(false);
      toast.success('Network restored');

      // Reconnect if disconnected
      if (!connected) {
        connect();
      }
    };

    const handleOffline = () => {
      console.log('🔌 Network offline');
      setNetworkIssue(true);
      toast.error('Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connected, connect]);

  return {
    // Connection state
    connected,
    status,
    error,
    networkIssue,

    // Interview state
    currentQuestion,
    phase,
    transcript,
    aiSpeaking,
    feedback,

    // Recording state
    isRecording,
    micEnabled,
    audioLevel,

    // Actions
    startRecording,
    stopRecording,
    toggleMicrophone,
    interruptAI,
    skipQuestion,
    endInterview,
    disconnect,
    sendMessage,  // Expose for manual message sending
    startInterview: () => sendMessage({ type: 'start' }) 
  };
};