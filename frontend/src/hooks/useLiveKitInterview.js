import { useEffect, useState, useCallback, useRef } from 'react';
import { Room, RoomEvent, Track, createLocalAudioTrack } from 'livekit-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const API_TOKEN = process.env.REACT_APP_API_TOKEN;

export const useLiveKitInterview = (sessionId, userId, userName) => {
  const [room, setRoom] = useState(null);
  const [token, setToken] = useState(null);
  const [url, setUrl] = useState(null);
  
  const [connected, setConnected] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [agentTranscript, setAgentTranscript] = useState('');
  const [error, setError] = useState(null);
  
  // Refs to track instances without triggering re-renders
  const roomRef = useRef(null);
  const audioPlayerRef = useRef(null);
  
  // ----------------------------------------------------------------
  // 1. Fetch Token (Only if sessionId changes)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!sessionId || !userId) return;

    let ignore = false;

    const fetchToken = async () => {
      try {
        const response = await fetch(`${API_URL}/livekit/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`
          },
          body: JSON.stringify({
            session_id: sessionId,
            user_id: userId,
            user_name: userName
          })
        });

        if (!response.ok) {
          throw new Error('Failed to get LiveKit token');
        }

        const data = await response.json();
        
        if (!ignore) {
          setToken(data.token);
          setUrl(data.url);
        }
      } catch (err) {
        console.error('Token fetch error:', err);
        if (!ignore) setError(err.message);
      }
    };

    fetchToken();

    return () => { ignore = true; };
  }, [sessionId, userId, userName]);


  // ----------------------------------------------------------------
  // 2. Connect to Room (Only when Token is available)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!token || !url) return;

    let isMounted = true;
    
    // Create Room instance
    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    roomRef.current = newRoom;

    const connectToRoom = async () => {
      try {
        if (!isMounted) return;

        // --- Event Listeners ---
        newRoom.on(RoomEvent.Connected, () => {
          if (isMounted) {
            console.log('✅ Connected to LiveKit room');
            setConnected(true);
            setRoom(newRoom);
          }
        });

        newRoom.on(RoomEvent.Disconnected, () => {
          if (isMounted) {
            console.log('❌ Disconnected from room');
            setConnected(false);
            setRoom(null);
          }
        });

        newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio && participant.identity.includes('agent')) {
            if (!audioPlayerRef.current) {
              audioPlayerRef.current = track.attach();
              document.body.appendChild(audioPlayerRef.current);
            } else {
              track.attach(audioPlayerRef.current);
            }
            if (isMounted) setAgentSpeaking(true);
          }
        });

        newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio && participant.identity.includes('agent')) {
            if (isMounted) setAgentSpeaking(false);
          }
        });

        newRoom.on(RoomEvent.DataReceived, (payload, participant) => {
          try {
            const data = JSON.parse(new TextDecoder().decode(payload));
            if (isMounted && data.type === 'transcript') {
              if (participant?.identity.includes('agent')) {
                setAgentTranscript(data.text);
              } else {
                setUserTranscript(data.text);
              }
            }
          } catch (err) {
            console.error('Failed to parse data:', err);
          }
        });

        // --- Connect ---
        await newRoom.connect(url, token);

        // --- Publish Mic ---
        if (isMounted && newRoom.state === 'connected') {
          try {
            const audioTrack = await createLocalAudioTrack({
              autoGainControl: true,
              echoCancellation: true,
              noiseSuppression: true
            });
            await newRoom.localParticipant.publishTrack(audioTrack);
            console.log('✅ Microphone published');
          } catch (micErr) {
            console.warn('Microphone failed (can retry manually):', micErr);
          }
        }

      } catch (err) {
        console.error('Connection failed:', err);
        if (isMounted) setError(err.message);
      }
    };

    connectToRoom();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log('🧹 Cleaning up room connection...');
      
      if (audioPlayerRef.current) {
        audioPlayerRef.current.remove();
        audioPlayerRef.current = null;
      }

      if (roomRef.current) {
        // Disconnect synchronously to stop all tracks immediately
        roomRef.current.disconnect(); 
        roomRef.current = null;
      }
    };
  }, [token, url]);


  // ----------------------------------------------------------------
  // 3. Helper Actions
  // ----------------------------------------------------------------
  
  const disconnect = useCallback(async () => {
    // 1. Local cleanup
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    setConnected(false);
    setRoom(null);

    // 2. Notify backend to kill pipeline
    if (sessionId) {
      try {
        await fetch(`${API_URL}/livekit/room/${sessionId}/end`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`
          }
        });
      } catch (err) {
        console.error('Backend disconnect notify failed:', err);
      }
    }
  }, [sessionId]);

  const toggleMicrophone = useCallback(async (enabled) => {
    if (roomRef.current?.localParticipant) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(enabled);
    }
  }, []);

  return {
    room,
    connected,
    agentSpeaking,
    userTranscript,
    agentTranscript,
    error,
    disconnect,
    toggleMicrophone
  };
};