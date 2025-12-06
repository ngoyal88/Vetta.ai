// frontend/src/hooks/useLiveKitInterview.js - WITH DEBUG LOGGING

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
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [phase, setPhase] = useState('behavioral');
  const [error, setError] = useState(null);
  
  const roomRef = useRef(null);
  const audioPlayerRef = useRef(null);
  
  // ✅ Fetch Token
  useEffect(() => {
    if (!sessionId || !userId) return;

    let ignore = false;

    const fetchToken = async () => {
      try {
        console.log('🎟️ Fetching token for session:', sessionId);
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
          console.log('✅ Token received');
          setToken(data.token);
          setUrl(data.url);
        }
      } catch (err) {
        console.error('❌ Token fetch error:', err);
        if (!ignore) setError(err.message);
      }
    };

    fetchToken();

    return () => { ignore = true; };
  }, [sessionId, userId, userName]);


  // ✅ Connect to Room
  useEffect(() => {
    if (!token || !url) return;

    let isMounted = true;
    
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

        console.log('🔌 Connecting to LiveKit...');

        // --- Event Listeners ---
        newRoom.on(RoomEvent.Connected, () => {
          if (isMounted) {
            console.log('✅ Connected to LiveKit room');
            console.log('Room name:', newRoom.name);
            console.log('Local participant:', newRoom.localParticipant.identity);
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

        // 🔥 CRITICAL: Track when agent publishes audio
        newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
          console.log('📢 Track published:', {
            kind: publication.kind,
            participant: participant.identity,
            trackName: publication.trackName
          });
        });

        // 🔥 CRITICAL: Subscribe to agent's audio track
        newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('🎧 Track subscribed:', {
            kind: track.kind,
            participant: participant.identity,
            trackSid: track.sid
          });
          
          if (track.kind === Track.Kind.Audio) {
            console.log('🔊 Audio track detected!');
            
            // Check if it's from agent
            if (participant.identity.includes('agent')) {
              console.log('✅ Agent audio track!');
              
              // Attach audio element
              if (!audioPlayerRef.current) {
                console.log('📻 Creating new audio element...');
                audioPlayerRef.current = track.attach();
                audioPlayerRef.current.autoplay = true;
                audioPlayerRef.current.volume = 1.0;
                document.body.appendChild(audioPlayerRef.current);
                console.log('✅ Audio element attached to DOM');
              } else {
                console.log('📻 Reusing existing audio element...');
                track.attach(audioPlayerRef.current);
              }
              
              if (isMounted) setAgentSpeaking(true);
              
              // Log audio element state
              console.log('🔊 Audio element state:', {
                paused: audioPlayerRef.current.paused,
                volume: audioPlayerRef.current.volume,
                muted: audioPlayerRef.current.muted,
                readyState: audioPlayerRef.current.readyState
              });
            }
          }
        });

        newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          console.log('🔇 Track unsubscribed:', participant.identity);
          if (track.kind === Track.Kind.Audio && participant.identity.includes('agent')) {
            if (isMounted) setAgentSpeaking(false);
          }
        });

        // 🔥 Handle question updates from agent
        newRoom.on(RoomEvent.DataReceived, (payload, participant) => {
          try {
            const data = JSON.parse(new TextDecoder().decode(payload));
            
            console.log('📩 Data received:', data);
            
            if (data.type === 'question_update') {
              if (isMounted) {
                console.log('❓ Question update:', data.question);
                setCurrentQuestion(data.question);
                
                if (data.phase) {
                  setPhase(data.phase);
                  console.log('🔄 Phase:', data.phase);
                }
              }
            }
          } catch (err) {
            console.error('❌ Data parse error:', err);
          }
        });

        // Log participant changes
        newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('👤 Participant joined:', participant.identity);
        });

        newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('👋 Participant left:', participant.identity);
        });

        // --- Connect ---
        console.log('🔗 Calling room.connect()...');
        await newRoom.connect(url, token);
        console.log('✅ room.connect() completed');

        // --- Publish Mic ---
        if (isMounted && newRoom.state === 'connected') {
          try {
            console.log('🎤 Publishing microphone...');
            const audioTrack = await createLocalAudioTrack({
              autoGainControl: true,
              echoCancellation: true,
              noiseSuppression: true
            });
            await newRoom.localParticipant.publishTrack(audioTrack);
            console.log('✅ Microphone published');
          } catch (micErr) {
            console.warn('⚠️ Microphone failed:', micErr);
          }
        }

        // Log initial room state
        setTimeout(() => {
          console.log('📊 Room State Check:');
          console.log('  - State:', newRoom.state);
          console.log('  - Participants:', newRoom.participants.size);
          console.log('  - Remote participants:', Array.from(newRoom.participants.values()).map(p => p.identity));
          console.log('  - Local tracks:', Array.from(newRoom.localParticipant.tracks.values()).map(t => t.kind));
        }, 2000);

      } catch (err) {
        console.error('❌ Connection failed:', err);
        if (isMounted) setError(err.message);
      }
    };

    connectToRoom();

    // Cleanup
    return () => {
      isMounted = false;
      console.log('🧹 Cleaning up connection...');
      
      if (audioPlayerRef.current) {
        audioPlayerRef.current.remove();
        audioPlayerRef.current = null;
      }

      if (roomRef.current) {
        roomRef.current.disconnect(); 
        roomRef.current = null;
      }
    };
  }, [token, url]);


  // --- Helper Functions ---
  
  const disconnect = useCallback(async () => {
    console.log('📴 Disconnecting...');
    
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    setConnected(false);
    setRoom(null);

    if (sessionId) {
      try {
        await fetch(`${API_URL}/livekit/room/${sessionId}/end`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`
          }
        });
        console.log('✅ Backend notified of disconnect');
      } catch (err) {
        console.error('⚠️ Backend disconnect notification failed:', err);
      }
    }
  }, [sessionId]);

  const toggleMicrophone = useCallback(async (enabled) => {
    if (roomRef.current?.localParticipant) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(enabled);
      console.log(`🎤 Microphone ${enabled ? 'enabled' : 'disabled'}`);
    }
  }, []);

  return {
    room,
    connected,
    agentSpeaking,
    userTranscript,
    agentTranscript,
    currentQuestion,
    phase,
    error,
    disconnect,
    toggleMicrophone
  };
};