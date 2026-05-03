import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, createLocalAudioTrack, RemoteTrack } from "livekit-client";
import { auth } from "firebaseConfig";
import { decodeJsonMessage, encodeJsonMessage } from "./utils/messageCodec";
import toast from "react-hot-toast";
import type { TransportOptions } from "../types";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
const isDev = process.env.NODE_ENV !== "production";

export const useTransportConnection = (options: TransportOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [connected, setConnected] = useState(false);
  const [networkIssue, setNetworkIssue] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const internalRoomRef = useRef<Room | null>(null);
  const roomRef = options.roomRef ?? internalRoomRef;
  const localAudioTrackRef = useRef<Awaited<ReturnType<typeof createLocalAudioTrack>> | null>(null);
  const remoteAudioElsRef = useRef(new Map<string, { el: HTMLAudioElement; track: RemoteTrack }>());
  const prevConnectionStateRef = useRef<string | null>(null);

  const sendControl = useCallback(
    (message: unknown) => {
      const room = roomRef.current;
      if (!room || room.state !== "connected") return;
      try {
        const payload = encodeJsonMessage(message);
        room.localParticipant.publishData(payload, { reliable: true, topic: "control" });
      } catch (e) {
        if (isDev) console.error("Failed to send control:", e);
      }
    },
    [roomRef]
  );

  const connect = useCallback(async () => {
    const { sessionId } = optionsRef.current;
    if (!sessionId) return;
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      if (!token) {
        setError("Not authenticated");
        toast.error("Please sign in to join the interview");
        return;
      }
      const tokenRes = await fetch(`${API_URL}/livekit/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to get LiveKit token");
      }

      const { token: lkToken, url: lkUrl } = await tokenRes.json();
      const wsUrl = (lkUrl || process.env.REACT_APP_LIVEKIT_URL || "").trim();
      if (!wsUrl) throw new Error("LiveKit URL is not configured");

      const room = new Room();
      roomRef.current = room;

      const attachRemoteAudioTrack = (track: RemoteTrack, participantIdentity = "") => {
        if (!track || track.kind !== "audio" || !track.sid) return;
        const key = `${participantIdentity}:${track.sid}`;
        if (remoteAudioElsRef.current.has(key)) return;
        const el = track.attach();
        el.autoplay = true;
        (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
        el.muted = false;
        el.style.display = "none";
        document.body.appendChild(el);
        el.play?.().catch(() => {});
        remoteAudioElsRef.current.set(key, { el, track });
      };

      const detachRemoteAudioTrack = (track: RemoteTrack, participantIdentity = "") => {
        if (!track || track.kind !== "audio" || !track.sid) return;
        const key = `${participantIdentity}:${track.sid}`;
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
          const decoded = decodeJsonMessage(payload as Uint8Array | string);
          if (!decoded.ok) return;
          const msg = decoded.message as { type?: string };
          if (topic === "audio_chunk" || msg.type === "audio_chunk") {
            optionsRef.current.onAudioChunk(msg);
            return;
          }
          if (msg && typeof msg.type === "string") {
            optionsRef.current.onMessage(msg);
          }
        } catch (e) {
          if (isDev && (topic === "control" || !topic)) console.error("Failed to parse control message", e);
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (participant.identity?.startsWith?.("interview-bot-")) {
          toast("Interview assistant disconnected.");
        }
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        void publication;
        attachRemoteAudioTrack(track, participant?.identity || "");
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        void publication;
        detachRemoteAudioTrack(track, participant?.identity || "");
      });

      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!roomRef.current) return;
        if (!roomRef.current.canPlaybackAudio) {
          optionsRef.current.onAudioUnlockPrompt?.();
          toast("Click anywhere on this page to hear your interviewer", {
            id: "audio-unlock",
            duration: Infinity,
          });
        } else {
          toast.dismiss("audio-unlock");
          optionsRef.current.onAudioUnlocked?.();
          remoteAudioElsRef.current.forEach(({ el }) => {
            el.play?.().catch(() => {});
          });
        }
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        const prevState = prevConnectionStateRef.current;
        prevConnectionStateRef.current = state;
        if (state === "reconnecting") {
          setReconnecting(true);
          setReconnectAttempt((a) => Math.min(a + 1, 3));
        } else if (state === "connected") {
          setReconnecting(false);
          setReconnectAttempt(0);
          if (prevState === "reconnecting") {
            optionsRef.current.addBanner?.("success", "Reconnected. Resuming your interview.", 3000);
            optionsRef.current.onReconnectSuccess?.();
          }
        }
      });

      await room.connect(wsUrl, lkToken);
      try {
        const attachRes = await fetch(`${API_URL}/livekit/attach`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!attachRes.ok) {
          const attachErr = await attachRes.json().catch(() => ({}));
          throw new Error(attachErr.detail || "Failed to dispatch LiveKit interview agent");
        }
      } catch (attachError) {
        const message = attachError instanceof Error ? attachError.message : "Failed to dispatch LiveKit interview agent";
        if (isDev) console.error("LiveKit attach request failed", attachError);
        throw new Error(message);
      }
      try {
        await room.startAudio();
      } catch (_) {}
      setConnected(true);
      setError(null);
      setNetworkIssue(false);
      toast.success("Connected to LiveKit interview");
      if (!room.canPlaybackAudio) {
        toast("Click anywhere on this page to hear your interviewer", {
          id: "audio-unlock",
          duration: Infinity,
        });
      }
    } catch (err: unknown) {
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch (_) {}
        roomRef.current = null;
      }
      if (isDev) console.error("LiveKit connect failed", err);
      const message = err instanceof Error ? err.message : "Failed to connect to LiveKit";
      setError(message);
      toast.error(message);
    }
  }, [roomRef]);

  const disconnect = useCallback(() => {
    toast.dismiss("audio-unlock");
    if (roomRef.current) {
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
  }, [roomRef]);

  useEffect(() => {
    if (!connected || !roomRef.current) return;

    let cancelled = false;
    let publishedTrack: Awaited<ReturnType<typeof createLocalAudioTrack>> | null = null;
    let publication: any = null;

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
        publication = await roomRef.current?.localParticipant.publishTrack(track);
        const micEnabledRef = optionsRef.current.micEnabledRef;
        if (publication && micEnabledRef && !micEnabledRef.current) {
          await publication.mute();
        }
      } catch (e) {
        if (isDev) console.error("Failed to publish local audio track", e);
      }
    };

    publishLocalAudio();

    return () => {
      cancelled = true;
      if (publication && publishedTrack && roomRef.current) {
        try {
          roomRef.current.localParticipant.unpublishTrack(publishedTrack);
        } catch (e) {
          if (isDev) console.warn("Failed to unpublish local audio track", e);
        }
      }
      if (publishedTrack) {
        publishedTrack.stop();
      }
      if (localAudioTrackRef.current === publishedTrack) {
        localAudioTrackRef.current = null;
      }
    };
  }, [connected, roomRef]);

  return {
    connected,
    error,
    networkIssue,
    reconnecting,
    reconnectAttempt,
    roomRef,
    localAudioTrackRef,
    remoteAudioElsRef,
    sendControl,
    connect,
    disconnect,
    setError,
    setNetworkIssue,
  };
};
