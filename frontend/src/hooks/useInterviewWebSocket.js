/**
 * WebSocket hook for interview room: connection, audio, VAD, reconnection.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecorder, AudioPlayer, checkBrowserSupport } from '../utils/audioUtils';
import { api } from '../services/api';
import { auth } from '../firebase';
import toast from 'react-hot-toast';

/**
 * Build WebSocket base URL at runtime so protocol matches the page (ws on http, wss on https).
 * Prevents "Invalid HTTP request" when env has wss:// but backend is plain ws.
 */
function getWebSocketBaseUrl() {
  const raw = (process.env.REACT_APP_WS_URL || '').trim();
  const isSecure = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  const protocol = isSecure ? 'wss:' : 'ws:';
  let hostPort = 'localhost:8000';
  if (raw) {
    try {
      const url = new URL(raw.startsWith('ws') ? raw : `ws://${raw}`);
      hostPort = url.host;
    } catch {
      hostPort = raw.replace(/^wss?:\/\//, '').replace(/\/.*$/, '').trim() || hostPort;
    }
  }
  return `${protocol}//${hostPort}/ws`;
}

export const useInterviewWebSocket = (sessionId, initialPhase = 'behavioral') => {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('disconnected');

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loadingNextProblem, setLoadingNextProblem] = useState(false);
  const [phase, setPhase] = useState(initialPhase);
  const [transcriptInterim, setTranscriptInterim] = useState('');
  const [transcriptFinal, setTranscriptFinal] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiFullText, setAiFullText] = useState('');
  const [aiSpeechWpm, setAiSpeechWpm] = useState(180);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);

  const [networkIssue, setNetworkIssue] = useState(false);
  const [messageQueue, setMessageQueue] = useState([]);

  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const aiTextFullRef = useRef('');
  const aiRevealTimerRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const audioLevelIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const handleMessageRef = useRef(null);
  const startHeartbeatRef = useRef(null);
  const stopHeartbeatRef = useRef(null);
  const flushMessageQueueRef = useRef(null);
  const attemptReconnectRef = useRef(null);
  const sendMessageRef = useRef(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;
  const HEARTBEAT_INTERVAL = 30000; // 30s
  const ACTIVITY_TIMEOUT = 300000; // 5min

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

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('⚠️ Already connected');
      return;
    }

    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;

      if (!token) {
        setError('Not authenticated');
        toast.error('Please sign in to join the interview');
        return;
      }

      const wsBase = getWebSocketBaseUrl();
      console.log('🔌 Connecting to WebSocket...', wsBase);
      const ws = new WebSocket(`${wsBase}/interview/${sessionId}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      // Connection opened
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnected(true);
        setStatus('connected');
        setError(null);
        setNetworkIssue(false);
        reconnectAttemptsRef.current = 0;

        startHeartbeatRef.current?.();
        flushMessageQueueRef.current?.();

        toast.success('Connected to interview');
      };

      // Message received
      ws.onmessage = (event) => {
        lastActivityRef.current = Date.now();
        handleMessageRef.current?.(JSON.parse(event.data));
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
        stopHeartbeatRef.current?.();

        if (event.code === 1000) {
          console.log('✅ Connection closed normally');
        } else if (event.code === 1006) {
          setNetworkIssue(true);
          attemptReconnectRef.current?.();
        } else {
          attemptReconnectRef.current?.();
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
        sendMessageRef.current?.({ type: 'ping' });

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
      case 'question': {
        const q = message.question;
        const inner = (message.phase === 'dsa' && q && typeof q === 'object' && q.question && typeof q.question === 'object')
          ? q.question
          : q;
        setCurrentQuestion(inner);
        setLoadingNextProblem(false);
        setPhase(message.phase);

        // Reset user transcript for the new turn
        setTranscriptInterim('');
        setTranscriptFinal('');

        // Determine full text that the AI will speak.
        let fullText = '';
        if (typeof message.spoken_text === 'string') {
          fullText = message.spoken_text;
        } else {
          // Fallback: attempt best-effort extraction
          const q = message.question;
          if (typeof q === 'string') fullText = q;
          else if (q && typeof q === 'object') {
            const nested = q.question;
            if (typeof nested === 'string') fullText = nested;
            else if (nested && typeof nested === 'object' && typeof nested.question === 'string') {
              fullText = nested.question;
            }
          }
        }

        aiTextFullRef.current = fullText || '';
        setAiFullText(fullText || '');

        // Reset displayed text; we will reveal progressively once audio starts.
        if (aiRevealTimerRef.current) {
          clearInterval(aiRevealTimerRef.current);
          aiRevealTimerRef.current = null;
        }
        setAiText('');

        // Play audio
        if (message.audio && playerRef.current) {
          setAiSpeaking(true);

          // CRITICAL: Stop recording when AI speaks (prevent echo)
          if (isRecording && recorderRef.current) {
            recorderRef.current.pause();
            console.log('⏸️ Paused recording - AI speaking');
          }

          playerRef.current.play(message.audio, {
            onStart: ({ durationSeconds } = {}) => {
              setAiSpeaking(true);
              console.log('🔊 AI started speaking');

              // Progressive reveal (word-by-word) based on audio duration.
              // This is approximate timing (no phoneme alignment), but feels natural.
              const text = (aiTextFullRef.current || '').trim();
              if (!text) return;

              const words = text.split(/\s+/).filter(Boolean);
              if (words.length <= 1) {
                setAiText(text);
                return;
              }

              // If duration isn't available yet, fall back to an estimate (~2.5 words/sec).
              const durSec = (Number.isFinite(durationSeconds) && durationSeconds > 0)
                ? durationSeconds
                : Math.max(1.0, words.length / 2.5);

              const durationMs = durSec * 1000;
              if (durSec) {
                const wpm = Math.max(80, Math.min(260, Math.round((words.length * 60) / durSec)));
                setAiSpeechWpm(wpm);
              }
              const start = performance.now();

              // Start with first word quickly.
              setAiText(words[0]);

              aiRevealTimerRef.current = setInterval(() => {
                const elapsed = performance.now() - start;
                const frac = Math.max(0, Math.min(1, elapsed / durationMs));
                const targetCount = Math.max(1, Math.ceil(frac * words.length));
                setAiText(words.slice(0, targetCount).join(' '));
                if (frac >= 1) {
                  clearInterval(aiRevealTimerRef.current);
                  aiRevealTimerRef.current = null;
                }
              }, 50);
            },
            onEnd: () => {
              setAiSpeaking(false);
              console.log('🔇 AI finished speaking');

              // Tell backend it can accept mic audio again (echo prevention gate).
              try {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'ai_playback_ended' }));
                }
              } catch (e) {
                console.warn('Failed to send ai_playback_ended:', e);
              }

              if (aiRevealTimerRef.current) {
                clearInterval(aiRevealTimerRef.current);
                aiRevealTimerRef.current = null;
              }
              // Ensure full text is visible at the end.
              if (aiTextFullRef.current) setAiText(aiTextFullRef.current);

              // Resume recording if was recording
              if (micEnabled && recorderRef.current) {
                recorderRef.current.resume();
                console.log('▶️ Resumed recording');
              }
            }
          });
        } else {
          // No audio: show full text immediately.
          if (aiTextFullRef.current) setAiText(aiTextFullRef.current);
          setAiSpeechWpm(180);
        }

        toast.success('New question received');
        break;
      }

      case 'transcript':
        if (message.is_final) {
          setTranscriptFinal((prev) => {
            const next = `${prev} ${message.text}`.trim();
            return next;
          });
          setTranscriptInterim('');
        } else {
          setTranscriptInterim(message.text);
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

      case 'feedback': {
        const payload = {
          feedback: message.feedback,
          full: message.full,
          duration_minutes: message.duration_minutes,
          questions_answered: message.questions_answered,
          code_problems_attempted: message.code_problems_attempted,
        };
        setFeedback(payload);
        try {
          if (sessionId) {
            sessionStorage.setItem(
              `interview_feedback_${sessionId}`,
              JSON.stringify(payload)
            );
          }
        } catch (e) {
          // ignore storage errors
        }
        toast.success('Interview completed!');
        break;
      }

      case 'pong':
        // Heartbeat response
        console.log('💓 Heartbeat received');
        break;

      case 'heartbeat':
        // Server keepalive — no action needed
        break;

      case 'error':
        setError(message.message);
        toast.error(`Error: ${message.message}`);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }, [isRecording, micEnabled, sessionId]);

  const queueMessage = useCallback((message) => {
    setMessageQueue(prev => [...prev, message]);
    console.log('📦 Message queued:', message.type);
  }, []);

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
  }, [queueMessage]);

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

  const startAudioLevelMonitoring = useCallback(() => {
    audioLevelIntervalRef.current = setInterval(() => {
      if (recorderRef.current) {
        const level = recorderRef.current.getAudioLevel();
        setAudioLevel(level);
      }
    }, 100);
  }, []);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);

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
          // IMPORTANT: disable auto-stop VAD.
          // We use manual turn-taking via the "I'm done" button (`answer_complete`).
          enableVAD: false
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
  }, [micEnabled, connected, aiSpeaking, sendMessage, startAudioLevelMonitoring]);

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
  }, [isRecording, sendMessage, stopAudioLevelMonitoring]);

  /**
   * Submit the current answer (manual turn-taking)
   */
  const submitAnswer = useCallback(async () => {
    if (!connected) return;
    if (aiSpeaking) {
      toast.error('Please wait for AI to finish speaking');
      return;
    }

    // Stop the mic if currently recording; backend will use buffered transcript
    if (isRecording) {
      await stopRecording();
    }

    sendMessage({ type: 'answer_complete' });
  }, [connected, aiSpeaking, isRecording, stopRecording, sendMessage]);

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
   * Skip current question (voice/behavioral interviews)
   */
  const skipQuestion = useCallback(() => {
    sendMessage({ type: 'skip_question' });
    toast.success('Skipping question...');
  }, [sendMessage]);

  /**
   * Request next DSA problem: clear current question and send dsa_next_question
   * so the UI shows "Loading next problem..." until the new question arrives.
   */
  const requestNextDSAQuestion = useCallback(() => {
    setCurrentQuestion(null);
    setLoadingNextProblem(true);
    sendMessage({ type: 'dsa_next_question' });
    toast.success('Loading next problem...');
  }, [sendMessage]);

  /**
   * End interview
   */
  const endInterview = useCallback(async () => {
    sendMessage({ type: 'end_interview' });

    // Also call REST completion so backend finalizes even if WS path misses it
    try {
      await api.completeInterview(sessionId);
    } catch (err) {
      console.error('REST completion failed', err);
    }
  }, [sendMessage, sessionId]);

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

  handleMessageRef.current = handleMessage;
  startHeartbeatRef.current = startHeartbeat;
  stopHeartbeatRef.current = stopHeartbeat;
  flushMessageQueueRef.current = flushMessageQueue;
  attemptReconnectRef.current = attemptReconnect;
  sendMessageRef.current = sendMessage;

  return {
    connected,
    status,
    error,
    networkIssue,

    // Interview state
    currentQuestion,
    loadingNextProblem,
    phase,
    transcriptInterim,
    transcriptFinal,
    aiText,
    aiFullText,
    aiSpeechWpm,
    aiSpeaking,
    feedback,

    // Recording state
    isRecording,
    micEnabled,
    audioLevel,

    // Actions
    startRecording,
    stopRecording,
    submitAnswer,
    toggleMicrophone,
    interruptAI,
    skipQuestion,
    requestNextDSAQuestion,
    endInterview,
    disconnect,
    sendMessage,  // Expose for manual message sending
    startInterview: () => sendMessage({ type: 'start' })
  };
};