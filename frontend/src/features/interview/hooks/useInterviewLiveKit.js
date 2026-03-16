/**
 * LiveKit interview hook: same public API as useInterviewWebSocket.
 * Transport: LiveKit data channel + optional byte streams. All AI stays in FastAPI.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import {
  AudioRecorder,
  StreamingAudioPlayer,
  checkBrowserSupport,
} from 'shared/utils/audioUtils';
import { api } from 'shared/services/api';
import { auth } from 'firebaseConfig';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const ATTACH_RETRIES = 3;
const ATTACH_DELAYS = [1000, 2000, 4000];
const BOT_JOIN_TIMEOUT_MS = 20000;
const CHUNKED_BUFFER_TIMEOUT_MS = 60000;
const MIC_RESUME_DELAY_MS = 250;
const INTERRUPT_ENERGY_THRESHOLD = 0.008;
const INTERRUPT_HOLD_MS = 180;
const INTERRUPT_DEBOUNCE_MS = 2000;
const MIN_PLAYBACK_BEFORE_INTERRUPT_MS = 2000;
const isDev = process.env.NODE_ENV !== 'production';

const isEditableElement = (target) => {
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase?.();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    !!target.closest?.('.monaco-editor')
  );
};

const base64ToUint8Array = (base64) => {
  try {
    const bytes = atob(base64 || '');
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) {
      buffer[i] = bytes.charCodeAt(i);
    }
    return buffer;
  } catch {
    return null;
  }
};

export const useInterviewLiveKit = (sessionId, initialPhase = 'behavioral', options = {}) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

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
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [sttFallbackActive, setSttFallbackActive] = useState(false);

  const roomRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const aiTextFullRef = useRef('');
  const aiRevealTimerRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);
  const chunkedBuffersRef = useRef({});
  const chunkedTimeoutRef = useRef({});
  const botJoinTimeoutRef = useRef(null);
  const lastControlReceivedRef = useRef(Date.now());
  const handleMessageRef = useRef(null);
  const playChunkedAudioRef = useRef(null);
  const encoderRef = useRef(new TextEncoder());
  const decoderRef = useRef(new TextDecoder());
  const aiSpeakingRef = useRef(false);
  const micEnabledRef = useRef(true);
  const isRecordingRef = useRef(false);
  const interruptCandidateSinceRef = useRef(null);
  const lastInterruptAtRef = useRef(0);
  const activeTtsStreamIdRef = useRef(null);
  const ttsTransportRef = useRef('packets');
  const supportsByteStreamsRef = useRef(false);
  const aiPlaybackStartedAtRef = useRef(0);
  const lastHeartbeatRef = useRef(0);
  const heartbeatWarningRef = useRef(null);
  const tabHiddenAtRef = useRef(null);
  const connectRef = useRef(null);
  const disconnectRef = useRef(null);

  const setAiSpeakingState = useCallback((nextValue) => {
    aiSpeakingRef.current = nextValue;
    setAiSpeaking(nextValue);
  }, []);

  const clearAiReveal = useCallback(() => {
    if (aiRevealTimerRef.current) {
      clearInterval(aiRevealTimerRef.current);
      aiRevealTimerRef.current = null;
    }
  }, []);

  const startAiReveal = useCallback((text, durationSeconds = null) => {
    clearAiReveal();
    const trimmed = (text || '').trim();
    aiTextFullRef.current = trimmed;
    setAiFullText(trimmed);
    if (!trimmed) {
      setAiText('');
      setAiSpeechWpm(180);
      return;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      setAiText(trimmed);
      setAiSpeechWpm(180);
      return;
    }

    const durSec = Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : Math.max(1.0, words.length / 2.5);
    const durationMs = durSec * 1000;
    setAiSpeechWpm(Math.max(80, Math.min(260, Math.round((words.length * 60) / durSec))));
    const start = performance.now();
    setAiText(words[0]);

    aiRevealTimerRef.current = setInterval(() => {
      const elapsed = performance.now() - start;
      const frac = Math.max(0, Math.min(1, elapsed / durationMs));
      const targetCount = Math.max(1, Math.ceil(frac * words.length));
      setAiText(words.slice(0, targetCount).join(' '));
      if (frac >= 1) {
        clearAiReveal();
      }
    }, 50);
  }, [clearAiReveal]);

  const scheduleMicResume = useCallback((delayMs = MIC_RESUME_DELAY_MS) => {
    if (!micEnabledRef.current || !recorderRef.current) return;
    recorderRef.current.resume(delayMs);
  }, []);

  const sendControl = useCallback((message) => {
    const room = roomRef.current;
    if (!room || room.state !== 'connected') return;
    try {
      const payload = encoderRef.current.encode(JSON.stringify(message));
      room.localParticipant.publishData(payload, { reliable: true, topic: 'control' });
    } catch (e) {
      if (isDev) console.error('Failed to send control:', e);
    }
  }, []);

  const finalizeAiPlayback = useCallback((shouldNotifyBackend = true) => {
    setAiSpeakingState(false);
    setStatus('listening');
    clearAiReveal();
    if (aiTextFullRef.current) {
      setAiText(aiTextFullRef.current);
    }
    activeTtsStreamIdRef.current = null;
    aiPlaybackStartedAtRef.current = 0;
    if (shouldNotifyBackend) {
      sendControl({ type: 'ai_playback_ended' });
    }
    scheduleMicResume();
  }, [clearAiReveal, scheduleMicResume, sendControl, setAiSpeakingState]);

  const stopAiPlaybackLocally = useCallback((messageType = null) => {
    if (playerRef.current) {
      playerRef.current.stop();
    }
    setAiSpeakingState(false);
    setStatus('listening');
    clearAiReveal();
    activeTtsStreamIdRef.current = null;
    aiPlaybackStartedAtRef.current = 0;
    if (messageType) {
      sendControl({ type: messageType });
    }
    scheduleMicResume();
  }, [clearAiReveal, scheduleMicResume, sendControl, setAiSpeakingState]);

  const applyQuestionMetadata = useCallback((message) => {
    const q = message?.question;
    const inner = (message?.phase === 'dsa' && q && typeof q === 'object' && q.question && typeof q.question === 'object')
      ? q.question
      : q;
    setCurrentQuestion(inner ?? null);
    setLoadingNextProblem(false);
    if (message?.phase) {
      setPhase(message.phase);
    }
    setTranscriptInterim('');
    setTranscriptFinal('');

    let fullText = typeof message?.spoken_text === 'string' ? message.spoken_text : '';
    if (!fullText && q) {
      if (typeof q === 'string') fullText = q;
      else if (typeof q?.question === 'string') fullText = q.question;
      else if (q?.question?.question) fullText = q.question.question;
    }
    aiTextFullRef.current = fullText || '';
    setAiFullText(fullText || '');
    setAiText('');
    setAiSpeechWpm(180);
  }, []);

  const startPacketTtsStream = useCallback((streamId) => {
    if (!playerRef.current?.startStream || !streamId) return;
    playerRef.current.startStream(streamId, {
      expectedStartChunks: 3,
      onStart: ({ durationSeconds } = {}) => {
        aiPlaybackStartedAtRef.current = Date.now();
        setAiSpeakingState(true);
        setStatus('speaking');
        startAiReveal(aiTextFullRef.current || '', durationSeconds);
      },
      onEnd: () => finalizeAiPlayback(true),
    });
  }, [finalizeAiPlayback, setAiSpeakingState, startAiReveal]);

  const handleTtsStreamStart = useCallback((message) => {
    activeTtsStreamIdRef.current = message.stream_id || null;
    ttsTransportRef.current = message.transport || (supportsByteStreamsRef.current ? 'bytes' : 'packets');
    applyQuestionMetadata(message);
    setStatus('thinking');

    if (recorderRef.current && isRecordingRef.current) {
      recorderRef.current.pause();
    }
    if (ttsTransportRef.current !== 'bytes') {
      startPacketTtsStream(message.stream_id);
    }
  }, [applyQuestionMetadata, startPacketTtsStream]);

  const handlePacketTtsChunk = useCallback(async (message) => {
    if (!message?.stream_id || !message?.data || !playerRef.current?.addChunk) return;
    const bytes = base64ToUint8Array(message.data);
    if (!bytes) return;
    await playerRef.current.addChunk(message.stream_id, bytes);
    if (message.is_last) {
      await playerRef.current.finalizeStream(message.stream_id);
    }
  }, []);

  const playChunkedAudio = useCallback((qid, base64Full, header) => {
    if (!playerRef.current?.play || !base64Full) return;
    setAiSpeakingState(true);
    if (isRecordingRef.current && recorderRef.current) recorderRef.current.pause();
    const spokenText = header?.spoken_text || '';
    aiTextFullRef.current = spokenText;
    setAiFullText(spokenText);

    playerRef.current.play(base64Full, {
      onStart: ({ durationSeconds } = {}) => {
        aiPlaybackStartedAtRef.current = Date.now();
        setStatus('speaking');
        startAiReveal(spokenText, durationSeconds);
      },
      onEnd: () => finalizeAiPlayback(true),
    });
  }, [finalizeAiPlayback, setAiSpeakingState, startAiReveal]);

  playChunkedAudioRef.current = playChunkedAudio;

  const ensureRecorderStarted = useCallback(async () => {
    if (!micEnabledRef.current) return false;
    if (roomRef.current?.state !== 'connected') return false;

    if (recorderRef.current && isRecordingRef.current) {
      recorderRef.current.resume(aiSpeakingRef.current ? MIC_RESUME_DELAY_MS : 0);
      return true;
    }

    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
      }

      await recorderRef.current.start(
        (audioChunk) => {
          const room = roomRef.current;
          if (room?.state !== 'connected' || !micEnabledRef.current) return;

          const level = recorderRef.current?.getAudioLevel?.() ?? 0;
          setAudioLevel(level);

          if (aiSpeakingRef.current) {
            const now = Date.now();
            if (level >= INTERRUPT_ENERGY_THRESHOLD) {
              if (!aiPlaybackStartedAtRef.current || now - aiPlaybackStartedAtRef.current < MIN_PLAYBACK_BEFORE_INTERRUPT_MS) {
                interruptCandidateSinceRef.current = null;
                return;
              }
              if (!interruptCandidateSinceRef.current) {
                interruptCandidateSinceRef.current = now;
              }
              if (
                now - interruptCandidateSinceRef.current >= INTERRUPT_HOLD_MS &&
                now - lastInterruptAtRef.current >= INTERRUPT_DEBOUNCE_MS
              ) {
                lastInterruptAtRef.current = now;
                interruptCandidateSinceRef.current = null;
                stopAiPlaybackLocally('user_speech_during_ai');
              }
            } else {
              interruptCandidateSinceRef.current = null;
            }
            return;
          }

          interruptCandidateSinceRef.current = null;
          audioChunk.arrayBuffer().then((buffer) => {
            try {
              room.localParticipant.publishData(new Uint8Array(buffer), {
                reliable: false,
                topic: 'audio',
              });
            } catch (e) {
              if (isDev) console.error('Failed to send LiveKit audio chunk', e);
            }
          });
        },
        {
          enableVAD: true,
          silenceThreshold: 0.02,
          silenceDuration: 1800,
          onSpeechStart: () => sendControl({ type: 'speech_started' }),
          onSpeechEnd: () => sendControl({ type: 'speech_ended' }),
        },
      );

      isRecordingRef.current = true;
      setIsRecording(true);
      sendControl({ type: 'start_recording' });
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
      audioLevelIntervalRef.current = setInterval(() => {
        if (recorderRef.current) {
          setAudioLevel(recorderRef.current.getAudioLevel?.() ?? 0);
        }
      }, 100);
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to start microphone streaming');
      return false;
    }
  }, [sendControl, stopAiPlaybackLocally]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !isRecordingRef.current) return;
    await recorderRef.current.stop();
    isRecordingRef.current = false;
    setIsRecording(false);
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
    sendControl({ type: 'stop_recording' });
  }, [sendControl]);

  const fallbackToWebSocket = useCallback(() => {
    try {
      sessionStorage.setItem('force_ws', '1');
      window.location.href = `/interview/${sessionId}?transport=ws`;
    } catch (e) {
      window.location.href = `/interview/${sessionId}`;
    }
  }, [sessionId]);

  const handleMessage = useCallback((message) => {
    lastControlReceivedRef.current = Date.now();
    if (botJoinTimeoutRef.current) {
      clearTimeout(botJoinTimeoutRef.current);
      botJoinTimeoutRef.current = null;
    }
    if (!message?.type) return;

    switch (message.type) {
      case 'question': {
        applyQuestionMetadata(message);
        clearAiReveal();
        if (message.audio && playerRef.current?.play) {
          setAiSpeakingState(true);
          if (isRecordingRef.current && recorderRef.current) recorderRef.current.pause();
          playerRef.current.play(message.audio, {
            onStart: ({ durationSeconds } = {}) => {
              aiPlaybackStartedAtRef.current = Date.now();
              setStatus('speaking');
              setAiSpeakingState(true);
              startAiReveal(aiTextFullRef.current || '', durationSeconds);
            },
            onEnd: () => finalizeAiPlayback(true),
          });
        } else if (aiTextFullRef.current) {
          setAiText(aiTextFullRef.current);
        }
        toast.success('New question received');
        break;
      }

      case 'question_chunked': {
        const qid = message.question_id;
        if (!qid) break;
        chunkedBuffersRef.current[qid] = {
          totalChunks: message.total_chunks || 0,
          chunks: {},
          header: {
            question: message.question,
            phase: message.phase,
            spoken_text: message.spoken_text,
            timestamp: message.timestamp,
          },
        };
        if (chunkedTimeoutRef.current[qid]) clearTimeout(chunkedTimeoutRef.current[qid]);
        chunkedTimeoutRef.current[qid] = setTimeout(() => {
          delete chunkedBuffersRef.current[qid];
          delete chunkedTimeoutRef.current[qid];
        }, CHUNKED_BUFFER_TIMEOUT_MS);
        applyQuestionMetadata(message);
        break;
      }

      case 'transcript': {
        const text = message.text || '';
        if (message.is_final) {
          setTranscriptFinal((prev) => (text ? `${prev} ${text}`.trim() : prev));
          setTranscriptInterim('');
        } else {
          setTranscriptInterim(text);
        }
        break;
      }

      case 'status':
        if (message.status === 'speaking') {
          setStatus((prev) => (prev === 'thinking' ? prev : 'speaking'));
        } else {
          setStatus(message.status);
        }
        if (message.status === 'speaking') {
          setAiSpeakingState(true);
        } else if (
          message.status === 'listening' ||
          message.status === 'interrupted' ||
          message.status === 'thinking'
        ) {
          setAiSpeakingState(false);
        }
        break;

      case 'interviewer_thinking':
        setStatus('thinking');
        break;

      case 'audio_started':
        aiPlaybackStartedAtRef.current = Date.now();
        setStatus('speaking');
        setAiSpeakingState(true);
        break;

      case 'audio_ended':
        aiPlaybackStartedAtRef.current = 0;
        setStatus('listening');
        setAiSpeakingState(false);
        break;

      case 'phase_change':
        setPhase(message.phase);
        if (message.phase === 'dsa') toast.success('Switching to coding challenge!', { duration: 3000 });
        break;

      case 'tts_stream_start':
        handleTtsStreamStart(message);
        break;

      case 'tts_chunk':
        handlePacketTtsChunk(message).catch((err) => {
          if (isDev) console.error('Failed to handle TTS chunk', err);
        });
        break;

      case 'tts_stream_end':
        playerRef.current?.finalizeStream?.(message.stream_id);
        break;

      case 'tts_stream_cancelled':
      case 'interrupt_ack':
        if (!message.stream_id || message.stream_id === activeTtsStreamIdRef.current) {
          stopAiPlaybackLocally(null);
        }
        break;

      case 'utterance_end_detected':
      case 'silence_warning':
        break;

      case 'feedback': {
        setFeedback({
          feedback: message.feedback,
          full: message.full,
          duration_minutes: message.duration_minutes,
          questions_answered: message.questions_answered,
          code_problems_attempted: message.code_problems_attempted,
        });
        try {
          if (sessionId) {
            sessionStorage.setItem(`interview_feedback_${sessionId}`, JSON.stringify({
              feedback: message.feedback,
              full: message.full,
              duration_minutes: message.duration_minutes,
              questions_answered: message.questions_answered,
              code_problems_attempted: message.code_problems_attempted,
            }));
          }
        } catch (e) {
          if (isDev) console.warn('Failed to persist interview feedback', e);
        }
        toast.success('Interview completed!');
        break;
      }

      case 'pong':
        break;

      case 'heartbeat':
        lastHeartbeatRef.current = Date.now();
        if (heartbeatWarningRef.current != null) {
          const removeBanner = optionsRef.current?.removeBanner;
          if (typeof removeBanner === 'function') removeBanner(heartbeatWarningRef.current);
          heartbeatWarningRef.current = null;
        }
        break;

      case 'reconnecting_stt': {
        const attempt = message.attempt ?? 1;
        const addBanner = optionsRef.current?.addBanner;
        if (typeof addBanner === 'function') {
          addBanner('warning', `Voice recognition reconnecting (${attempt} of 3)…`);
        }
        break;
      }

      case 'stt_restored': {
        const addBanner = optionsRef.current?.addBanner;
        const removeBannerByType = optionsRef.current?.removeBannerByType;
        if (typeof removeBannerByType === 'function') removeBannerByType('warning');
        if (typeof addBanner === 'function') addBanner('success', 'Voice recognition restored.', 3000);
        setSttFallbackActive(false);
        break;
      }

      case 'stt_unavailable': {
        setSttFallbackActive(true);
        const addBanner = optionsRef.current?.addBanner;
        if (typeof addBanner === 'function') {
          addBanner('warning', 'Voice recognition is unavailable. Use the text box below to type your answer.');
        }
        break;
      }

      case 'error':
        setError(message.message);
        toast.error(`Error: ${message.message}`);
        break;

      default:
        if (isDev) console.warn('Unknown message type:', message.type);
    }
  }, [
    applyQuestionMetadata,
    clearAiReveal,
    finalizeAiPlayback,
    handlePacketTtsChunk,
    handleTtsStreamStart,
    sessionId,
    setAiSpeakingState,
    setSttFallbackActive,
    startAiReveal,
    stopAiPlaybackLocally,
  ]);

  const registerByteStreamHandlers = useCallback((room) => {
    if (typeof room.registerByteStreamHandler !== 'function') {
      ttsTransportRef.current = 'packets';
      return;
    }
    supportsByteStreamsRef.current = true;

    room.registerByteStreamHandler('tts', (reader) => {
      const info = reader.info || {};
      const streamId = info.attributes?.stream_id || info.streamId || info.id || `${Date.now()}`;
      ttsTransportRef.current = 'bytes';
      activeTtsStreamIdRef.current = streamId;

      playerRef.current?.startStream?.(streamId, {
        onStart: ({ durationSeconds } = {}) => {
          aiPlaybackStartedAtRef.current = Date.now();
          setAiSpeakingState(true);
          setStatus('speaking');
          startAiReveal(aiTextFullRef.current || '', durationSeconds);
        },
        onEnd: () => finalizeAiPlayback(true),
      });

      (async () => {
        for await (const chunk of reader) {
          await playerRef.current?.addChunk?.(streamId, chunk);
        }
        await playerRef.current?.finalizeStream?.(streamId);
      })().catch((error) => {
        if (isDev) console.error('TTS byte stream failed', error);
        stopAiPlaybackLocally(null);
      });
    });
  }, [finalizeAiPlayback, setAiSpeakingState, startAiReveal, stopAiPlaybackLocally]);

  const connect = useCallback(async () => {
    if (!sessionId) return;
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;
    if (!token) {
      setError('Not authenticated');
      toast.error('Please sign in to join the interview');
      return;
    }

    try {
      const tokenRes = await fetch(`${API_URL}/livekit/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to get LiveKit token');
      }

      const { token: lkToken, url: lkUrl } = await tokenRes.json();
      const wsUrl = (lkUrl || process.env.REACT_APP_LIVEKIT_URL || '').trim();
      if (!wsUrl) throw new Error('LiveKit URL is not configured');

      const room = new Room();
      roomRef.current = room;
      registerByteStreamHandlers(room);

      room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        if (topic === 'audio_chunk') {
          try {
            const text = typeof payload === 'string' ? payload : decoderRef.current.decode(payload);
            const msg = JSON.parse(text);
            const qid = msg.question_id;
            if (!qid) return;
            const buf = chunkedBuffersRef.current[qid];
            if (!buf) return;
            buf.chunks[msg.chunk_index] = msg.data;
            const received = Object.keys(buf.chunks).length;
            if (received >= buf.totalChunks) {
              const ordered = [];
              for (let i = 0; i < buf.totalChunks; i += 1) ordered.push(buf.chunks[i] || '');
              const fullB64 = ordered.join('');
              delete chunkedBuffersRef.current[qid];
              if (chunkedTimeoutRef.current[qid]) {
                clearTimeout(chunkedTimeoutRef.current[qid]);
                delete chunkedTimeoutRef.current[qid];
              }
              playChunkedAudioRef.current?.(qid, fullB64, buf.header);
            }
          } catch (e) {
            if (isDev) console.error('Failed to parse audio_chunk', e);
          }
          return;
        }

        try {
          const text = typeof payload === 'string' ? payload : decoderRef.current.decode(payload);
          const msg = JSON.parse(text);
          if (msg && typeof msg.type === 'string') {
            handleMessageRef.current?.(msg);
          }
        } catch (e) {
          if (isDev && (topic === 'control' || !topic)) console.error('Failed to parse control message', e);
        }
      });

      let attachWithRetryFn;
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (participant.identity?.startsWith?.('interview-bot-')) {
          toast('Interview assistant disconnected. Reconnecting…');
          attachWithRetryFn?.();
        }
      });

      room.on(RoomEvent.ConnectionStateChanged, (state, prevState) => {
        if (state === 'reconnecting') {
          setReconnecting(true);
          setReconnectAttempt((a) => Math.min(a + 1, 3));
        } else if (state === 'connected') {
          setReconnecting(false);
          setReconnectAttempt(0);
          const addBanner = optionsRef.current?.addBanner;
          if (typeof addBanner === 'function' && prevState === 'reconnecting') {
            addBanner('success', 'Reconnected. Resuming your interview.', 3000);
            const codeEditorRef = optionsRef.current?.codeEditorRef?.current;
            const codeBackup = sessionId ? localStorage.getItem(`roundr_code_backup_${sessionId}`) : null;
            const langBackup = sessionId ? localStorage.getItem(`roundr_code_lang_${sessionId}`) : null;
            if (codeEditorRef && codeBackup != null && (!codeEditorRef.getValue() || !codeEditorRef.getValue().trim())) {
              codeEditorRef.setValue(codeBackup);
              if (typeof codeEditorRef.setLanguage === 'function' && langBackup) codeEditorRef.setLanguage(langBackup);
              if (typeof addBanner === 'function') addBanner('success', 'Your code has been restored.', 3000);
            }
          }
        }
      });

      await room.connect(wsUrl, lkToken);
      setConnected(true);
      setError(null);
      setNetworkIssue(false);
      toast.success('Connected to LiveKit interview');
      await ensureRecorderStarted();

      attachWithRetryFn = async () => {
        const authToken = await auth.currentUser?.getIdToken?.().catch(() => token);
        const bearerToken = authToken || token;
        for (let attempt = 0; attempt < ATTACH_RETRIES; attempt += 1) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, ATTACH_DELAYS[attempt - 1]));
          try {
            const attachRes = await fetch(`${API_URL}/livekit/attach`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearerToken}` },
              body: JSON.stringify({ session_id: sessionId }),
            });
            const body = await attachRes.json().catch(() => ({}));
            if (attachRes.status === 409 && body?.detail?.error === 'session_already_active') {
              // Pre-warm already attached the bot; treat as success and continue (no retry, no user error).
              if (botJoinTimeoutRef.current) clearTimeout(botJoinTimeoutRef.current);
              botJoinTimeoutRef.current = setTimeout(() => {
                setError("Interview assistant didn't connect. Try again or use standard connection.");
                toast.error("Interview assistant didn't connect.");
              }, BOT_JOIN_TIMEOUT_MS);
              return;
            }
            if (attachRes.ok) {
              if (botJoinTimeoutRef.current) clearTimeout(botJoinTimeoutRef.current);
              botJoinTimeoutRef.current = setTimeout(() => {
                setError("Interview assistant didn't connect. Try again or use standard connection.");
                toast.error("Interview assistant didn't connect.");
              }, BOT_JOIN_TIMEOUT_MS);
              return;
            }
            if (attachRes.status >= 400 && attachRes.status < 500) break;
          } catch (e) {
            if (isDev) console.warn('Attach attempt failed', e);
          }
        }
        setError('Could not start the interview (LiveKit). Try again or use the standard connection.');
        toast.error('Could not start interview. Use standard connection?');
      };

      await attachWithRetryFn();
    } catch (err) {
      if (isDev) console.error('LiveKit connect failed', err);
      setError(err.message || 'Failed to connect to LiveKit');
      toast.error(err.message || 'LiveKit connection failed');
    }
  }, [ensureRecorderStarted, registerByteStreamHandlers, sessionId]);

  const disconnect = useCallback(() => {
    if (botJoinTimeoutRef.current) {
      clearTimeout(botJoinTimeoutRef.current);
      botJoinTimeoutRef.current = null;
    }
    Object.values(chunkedTimeoutRef.current).forEach(clearTimeout);
    chunkedTimeoutRef.current = {};
    chunkedBuffersRef.current = {};
    clearAiReveal();
    if (recorderRef.current) {
      recorderRef.current.cleanup();
      recorderRef.current = null;
    }
    isRecordingRef.current = false;
    if (playerRef.current) playerRef.current.stop();
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    if (roomRef.current) {
      try {
        roomRef.current.unregisterByteStreamHandler?.('tts');
      } catch (error) {
        // Ignore missing handler support.
      }
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setConnected(false);
    setStatus('disconnected');
    setIsRecording(false);
    setAiSpeakingState(false);
  }, [clearAiReveal, setAiSpeakingState]);

  connectRef.current = connect;
  disconnectRef.current = disconnect;

  const startRecording = useCallback(async () => {
    if (!micEnabledRef.current) {
      toast.error('Enable the microphone first');
      return;
    }
    await ensureRecorderStarted();
  }, [ensureRecorderStarted]);

  const submitAnswer = useCallback(() => {
    if (!connected) return;
    if (aiSpeakingRef.current) {
      toast.error('Please wait for AI to finish speaking');
      return;
    }
    sendControl({ type: 'hint_done_speaking' });
    setTranscriptInterim('');
    setTranscriptFinal('');
  }, [connected, sendControl]);

  const toggleMicrophone = useCallback(async (enabled) => {
    micEnabledRef.current = enabled;
    setMicEnabled(enabled);
    if (!enabled) {
      await stopRecording();
    } else {
      await ensureRecorderStarted();
    }
    toast.success(enabled ? 'Microphone enabled' : 'Microphone muted');
  }, [ensureRecorderStarted, stopRecording]);

  const interruptAI = useCallback(() => {
    if (!aiSpeakingRef.current) return;
    stopAiPlaybackLocally('interrupt');
    toast.info('AI interrupted');
  }, [stopAiPlaybackLocally]);

  const skipQuestion = useCallback(() => {
    sendControl({ type: 'skip_question' });
    toast.success('Skipping question...');
  }, [sendControl]);

  const requestNextDSAQuestion = useCallback(() => {
    setCurrentQuestion(null);
    setLoadingNextProblem(true);
    sendControl({ type: 'dsa_next_question' });
    toast.success('Loading next problem...');
  }, [sendControl]);

  const endInterview = useCallback(async () => {
    sendControl({ type: 'end_interview' });
    try {
      await api.completeInterview(sessionId);
    } catch (err) {
      if (isDev) console.error('REST completion failed', err);
    }
  }, [sendControl, sessionId]);

  handleMessageRef.current = handleMessage;

  useEffect(() => {
    aiSpeakingRef.current = aiSpeaking;
  }, [aiSpeaking]);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (!connected) return;
    const HEARTBEAT_CHECK_MS = 10000;
    const HEARTBEAT_STALE_MS = 30000;
    const interval = setInterval(() => {
      if (lastHeartbeatRef.current === 0) return;
      if (Date.now() - lastHeartbeatRef.current <= HEARTBEAT_STALE_MS) return;
      if (heartbeatWarningRef.current != null) return;
      const addBanner = optionsRef.current?.addBanner;
      if (typeof addBanner === 'function') {
        heartbeatWarningRef.current = addBanner('warning', 'Connection to your interviewer may be unstable.');
      }
    }, HEARTBEAT_CHECK_MS);
    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    if (!connected || !sessionId) return;
    const onVisibility = () => {
      const opts = optionsRef.current;
      if (document.hidden) {
        tabHiddenAtRef.current = Date.now();
        try {
          if (recorderRef.current?.audioContext?.state === 'running') {
            recorderRef.current.audioContext.suspend();
          }
        } catch (_) {}
        const codeEditorRef = opts?.codeEditorRef?.current;
        if (codeEditorRef && typeof codeEditorRef.getValue === 'function') {
          const value = codeEditorRef.getValue();
          const lang = typeof codeEditorRef.getLanguage === 'function' ? codeEditorRef.getLanguage() : '';
          try {
            localStorage.setItem(`roundr_code_backup_${sessionId}`, value ?? '');
            localStorage.setItem(`roundr_code_lang_${sessionId}`, lang ?? '');
          } catch (_) {}
        }
      } else {
        try {
          if (recorderRef.current?.audioContext?.state === 'suspended') {
            recorderRef.current.audioContext.resume();
          }
        } catch (_) {}
        const hiddenAt = tabHiddenAtRef.current;
        if (hiddenAt != null) {
          const durationMs = Date.now() - hiddenAt;
          tabHiddenAtRef.current = null;
          const addBanner = opts?.addBanner;
          if (typeof addBanner === 'function') {
            if (durationMs > 300000) {
              addBanner('info', `You were away for ${Math.round(durationMs / 60000)} minutes. Your progress is saved.`);
            } else if (durationMs > 5000) {
              addBanner('info', 'You were away for a moment. Your progress is saved.');
            }
          }
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [connected, sessionId]);

  useEffect(() => {
    const support = checkBrowserSupport();
    if (!support.supported) {
      const missing = Object.entries(support.features)
        .filter(([, supported]) => !supported)
        .map(([feature]) => feature);
      setError(`Browser not supported. Missing: ${missing.join(', ')}`);
      toast.error('Browser not supported for voice interviews');
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (phase === 'greeting') return;
      if (aiSpeaking) return;
      if (!connected) return;
      if (isEditableElement(event.target)) return;
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault();
      if (event.code === 'Space') {
        sendControl({ type: 'hint_done_speaking' });
      } else {
        sendControl({ type: 'answer_complete' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, aiSpeaking, connected, sendControl]);

  useEffect(() => {
    if (!sessionId) return;
    playerRef.current = new StreamingAudioPlayer();
    connectRef.current?.();
    return () => {
      disconnectRef.current?.();
    };
  }, [sessionId]);

  return {
    connected,
    status,
    error,
    networkIssue,
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
    isRecording,
    micEnabled,
    audioLevel,
    startRecording,
    stopRecording,
    submitAnswer,
    toggleMicrophone,
    interruptAI,
    skipQuestion,
    requestNextDSAQuestion,
    endInterview,
    disconnect,
    sendControl,
    sendMessage: sendControl,
    startInterview: () => sendControl({ type: 'start' }),
    fallbackToWebSocket,
    reconnecting,
    reconnectAttempt,
    sttFallbackActive,
    setSttFallbackActive,
  };
};
