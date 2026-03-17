/**
 * React hook for a LiveKit-based interview session.
 *
 * Connects to a LiveKit room, subscribes to remote audio tracks, sends and
 * receives control messages via the data channel, and manages microphone
 * recording lifecycle. Exports the same public API as useInterviewWebSocket
 * so either hook can be swapped in by App.jsx.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';
import {
  AudioRecorder,
  checkBrowserSupport,
} from 'shared/utils/audioUtils';
import { api } from 'shared/services/api';
import { auth } from 'firebaseConfig';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
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
  const localAudioTrackRef = useRef(null);
  const aiTextFullRef = useRef('');
  const aiRevealTimerRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);
  const lastControlReceivedRef = useRef(Date.now());
  const handleMessageRef = useRef(null);
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
  const remoteAudioElsRef = useRef(new Map());
  const audioUnlockedRef = useRef(false);

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


  const stopAiPlaybackLocally = useCallback((messageType = null) => {
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
        () => {
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
    if (!message?.type) return;

    switch (message.type) {
      case 'question': {
        applyQuestionMetadata(message);
        clearAiReveal();
        if (aiTextFullRef.current) {
          setAiText(aiTextFullRef.current);
        }
        toast.success('New question received');
        break;
      }

      case 'transcript': {
        const text = message.text || '';
        if (message.is_final) {
          setTranscriptFinal(text);
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
        setTranscriptFinal('');
        setTranscriptInterim('');
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

      case 'tts_stream_cancelled':
      case 'interrupt_ack':
        if (!message.stream_id || message.stream_id === activeTtsStreamIdRef.current) {
          stopAiPlaybackLocally(null);
        }
        break;

      case 'ai_transcript': {
        const aiTxt = message.text || '';
        if (aiTxt) {
          aiTextFullRef.current = aiTxt;
          setAiFullText(aiTxt);
          setAiText(aiTxt);
          setTranscriptInterim('');
          setTranscriptFinal('');
        }
        break;
      }

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
    sessionId,
    setAiSpeakingState,
    setSttFallbackActive,
    stopAiPlaybackLocally,
  ]);

  const registerByteStreamHandlers = useCallback((room) => {
    void room;
    ttsTransportRef.current = 'packets';
    supportsByteStreamsRef.current = false;
  }, []);

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

      const attachRemoteAudioTrack = (track, participantIdentity = '') => {
        if (!track || track.kind !== 'audio') return;
        const key = `${participantIdentity}:${track.sid || Math.random().toString(36).slice(2)}`;
        if (remoteAudioElsRef.current.has(key)) return;
        const el = track.attach();
        el.autoplay = true;
        el.playsInline = true;
        el.muted = false;
        el.style.display = 'none';
        document.body.appendChild(el);
        el.play?.().catch(() => {
          // Browser may block until user gesture; unlocked handler retries.
        });
        remoteAudioElsRef.current.set(key, { el, track });
      };

      const detachRemoteAudioTrack = (track, participantIdentity = '') => {
        if (!track || track.kind !== 'audio') return;
        const key = `${participantIdentity}:${track.sid || ''}`;
        const entry = remoteAudioElsRef.current.get(key);
        if (!entry) return;
        try {
          entry.track.detach(entry.el);
        } catch (_) {}
        try {
          entry.el.remove();
        } catch (_) {}
        remoteAudioElsRef.current.delete(key);
      };

      room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
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

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (participant.identity?.startsWith?.('interview-bot-')) {
          toast('Interview assistant disconnected.');
        }
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        void publication;
        attachRemoteAudioTrack(track, participant?.identity || '');
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        void publication;
        detachRemoteAudioTrack(track, participant?.identity || '');
      });

      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!roomRef.current) return;
        if (!roomRef.current.canPlaybackAudio) {
          toast('🔊 Click anywhere on this page to hear your interviewer', {
            id: 'audio-unlock',
            duration: Infinity,
            icon: '🔊',
          });
        } else {
          toast.dismiss('audio-unlock');
          remoteAudioElsRef.current.forEach(({ el }) => {
            el.play?.().catch(() => {});
          });
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
      // Try to unlock the AudioContext immediately. This only works if we are still
      // within a browser user-gesture window (typically < 1 s after the click that
      // triggered this connect). If it fails the AudioPlaybackStatusChanged handler
      // below will catch the blocked state and show a visible prompt.
      try { await room.startAudio(); } catch (_) {}
      setConnected(true);
      setError(null);
      setNetworkIssue(false);
      toast.success('Connected to LiveKit interview');
      // If audio is already blocked after connecting, show the prompt immediately
      // so the user has time to click before the greeting starts.
      if (!room.canPlaybackAudio) {
        toast('🔊 Click anywhere on this page to hear your interviewer', {
          id: 'audio-unlock',
          duration: Infinity,
          icon: '🔊',
        });
      }
    } catch (err) {
      if (isDev) console.error('LiveKit connect failed', err);
      setError(err.message || 'Failed to connect to LiveKit');
      toast.error(err.message || 'LiveKit connection failed');
    }
  }, [registerByteStreamHandlers, sessionId]);

  const disconnect = useCallback(() => {
    audioUnlockedRef.current = false;
    toast.dismiss('audio-unlock');
    clearAiReveal();
    if (recorderRef.current) {
      recorderRef.current.cleanup();
      recorderRef.current = null;
    }
    isRecordingRef.current = false;
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }
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
    remoteAudioElsRef.current.forEach(({ el, track }) => {
      try {
        track.detach(el);
      } catch (_) {}
      try {
        el.remove();
      } catch (_) {}
    });
    remoteAudioElsRef.current.clear();
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
    const pubs = roomRef.current?.localParticipant?.getTrackPublications?.() ?? [];
    for (const pub of pubs) {
      if (pub.kind === 'audio') {
        if (enabled) {
          await pub.unmute();
        } else {
          await pub.mute();
        }
      }
    }
    toast.success(enabled ? 'Microphone enabled' : 'Microphone muted');
  }, []);

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
    if (!connected || !roomRef.current) return undefined;

    let cancelled = false;
    let publishedTrack = null;
    let publication = null;

    const publishLocalAudio = async () => {
      try {
        const track = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        if (cancelled) {
          track.stop();
          return;
        }
        publishedTrack = track;
        localAudioTrackRef.current = track;
        publication = await roomRef.current.localParticipant.publishTrack(track);
        if (!micEnabledRef.current) {
          await publication.mute();
        }
      } catch (e) {
        if (isDev) console.error('Failed to publish local audio track', e);
      }
    };

    publishLocalAudio();

    return () => {
      cancelled = true;
      if (publication) {
        try {
          roomRef.current?.localParticipant?.unpublishTrack?.(publishedTrack);
        } catch (e) {
          if (isDev) console.warn('Failed to unpublish local audio track', e);
        }
      }
      if (publishedTrack) {
        publishedTrack.stop();
      }
      if (localAudioTrackRef.current === publishedTrack) {
        localAudioTrackRef.current = null;
      }
    };
  }, [connected]);

  useEffect(() => {
    if (!connected) return;
    const unlockAudioAndMic = async () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      // room.startAudio() resumes LiveKit's internal AudioContext and retries
      // playback on all subscribed remote tracks — the correct fix for autoplay policy.
      if (roomRef.current) {
        try { await roomRef.current.startAudio(); } catch (_) {}
      }
      toast.dismiss('audio-unlock');
      remoteAudioElsRef.current.forEach(({ el }) => {
        el.play?.().catch(() => {});
      });
      try {
        await ensureRecorderStarted();
      } catch (_) {}
    };
    window.addEventListener('pointerdown', unlockAudioAndMic, { once: true });
    window.addEventListener('keydown', unlockAudioAndMic, { once: true });
    window.addEventListener('touchstart', unlockAudioAndMic, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudioAndMic);
      window.removeEventListener('keydown', unlockAudioAndMic);
      window.removeEventListener('touchstart', unlockAudioAndMic);
    };
  }, [connected, ensureRecorderStarted]);

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
