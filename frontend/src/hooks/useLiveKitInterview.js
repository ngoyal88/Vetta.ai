import { useEffect, useState, useCallback, useRef } from 'react';
import { Room, RoomEvent, Track, createLocalAudioTrack } from 'livekit-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const API_TOKEN = process.env.REACT_APP_API_TOKEN;

export const useLiveKitInterview = (sessionId, userId, userName) => {
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [agentTranscript, setAgentTranscript] = useState('');
  const [error, setError] = useState(null);
  
  const audioPlayerRef = useRef(null);
  const localTrackRef = useRef(null);

  const connect = useCallback(async () => {
    if (!sessionId || !userId) return;

    try {
      // 1. Get LiveKit token from backend
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

      if (!response.ok) throw new Error('Failed to get LiveKit token');

      const { token, url } = await response.json();

      // 2. Create LiveKit room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // 3. Event handlers
      newRoom.on(RoomEvent.Connected, () => {
        console.log('✅ Connected to LiveKit room');
        setConnected(true);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log('❌ Disconnected from room');
        setConnected(false);
      });

      // Handle agent audio (AI voice)
      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio && participant.identity.includes('agent')) {
          console.log('🔊 Agent audio track received');
          
          // Attach to audio element
          if (!audioPlayerRef.current) {
            audioPlayerRef.current = track.attach();
            document.body.appendChild(audioPlayerRef.current);
          } else {
            track.attach(audioPlayerRef.current);
          }
          
          setAgentSpeaking(true);
        }
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio && participant.identity.includes('agent')) {
          setAgentSpeaking(false);
        }
      });

      // Handle data messages (transcripts, questions)
      newRoom.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));
          
          if (data.type === 'transcript') {
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

      // 4. Connect to room
      await newRoom.connect(url, token);
      setRoom(newRoom);

      // 5. Publish microphone
      const audioTrack = await createLocalAudioTrack({
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true
      });
      
      await newRoom.localParticipant.publishTrack(audioTrack);
      localTrackRef.current = audioTrack;
      
      console.log('✅ Microphone published');

    } catch (err) {
      console.error('LiveKit connection failed:', err);
      setError(err.message);
    }
  }, [sessionId, userId, userName]);

  const disconnect = useCallback(async () => {
    if (room) {
      // Clean up audio
      if (audioPlayerRef.current) {
        audioPlayerRef.current.srcObject = null;
        audioPlayerRef.current.remove();
        audioPlayerRef.current = null;
      }
      
      // Stop local track
      if (localTrackRef.current) {
        localTrackRef.current.stop();
        localTrackRef.current = null;
      }
      
      // Disconnect room
      await room.disconnect();
      setRoom(null);
      setConnected(false);
      
      // Notify backend
      try {
        await fetch(`${API_URL}/livekit/room/${sessionId}/end`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`
          }
        });
      } catch (err) {
        console.error('Failed to notify backend:', err);
      }
    }
  }, [room, sessionId]);

  const toggleMicrophone = useCallback(async (enabled) => {
    if (room) {
      await room.localParticipant.setMicrophoneEnabled(enabled);
    }
  }, [room]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

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