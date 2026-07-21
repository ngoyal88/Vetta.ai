import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { RemoteTrack } from "livekit-client";

type RemoteAudioEntry = { el: HTMLAudioElement; track: RemoteTrack };

/**
 * Smoothed 0..1 energy from the LiveKit remote agent audio track.
 * Updates energyRef every animation frame (no React re-render).
 * Falls back to a gentle pulse when aiSpeaking but no analysable track yet.
 */
export function useAgentAudioEnergy(
  remoteAudioElsRef: RefObject<Map<string, RemoteAudioEntry>> | MutableRefObject<Map<string, RemoteAudioEntry>>,
  aiSpeaking: boolean,
  enabled = true,
): MutableRefObject<number> {
  const energyRef = useRef(0);
  const aiSpeakingRef = useRef(aiSpeaking);
  aiSpeakingRef.current = aiSpeaking;

  useEffect(() => {
    if (!enabled) {
      energyRef.current = 0;
      return undefined;
    }

    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let attachedKey: string | null = null;
    let raf = 0;
    let smooth = 0;
    const data = new Uint8Array(128);

    const detachAnalyser = () => {
      analyser = null;
      attachedKey = null;
      if (ctx) {
        void ctx.close().catch(() => {});
        ctx = null;
      }
    };

    const attachToEntry = (key: string, entry: RemoteAudioEntry) => {
      const mediaTrack = entry.track?.mediaStreamTrack;
      if (!mediaTrack || mediaTrack.readyState === "ended") return false;
      try {
        detachAnalyser();
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AudioCtx();
        const stream = new MediaStream([mediaTrack]);
        const source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        attachedKey = key;
        if (ctx.state === "suspended") void ctx.resume().catch(() => {});
        return true;
      } catch {
        detachAnalyser();
        return false;
      }
    };

    const pickEntry = (): [string, RemoteAudioEntry] | null => {
      const map = remoteAudioElsRef.current;
      if (!map || map.size === 0) return null;
      for (const [key, entry] of map) {
        if (entry?.track?.kind === "audio") return [key, entry];
      }
      return null;
    };

    const tick = (t: number) => {
      const picked = pickEntry();
      if (picked) {
        const [key, entry] = picked;
        if (key !== attachedKey) attachToEntry(key, entry);
      } else if (attachedKey) {
        detachAnalyser();
      }

      let target = 0;
      if (analyser) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Scale typical speech RMS into a readable 0..1 pulse.
        target = Math.min(1, rms * 4.5);
      } else if (aiSpeakingRef.current) {
        target = 0.28 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.004));
      }

      if (!aiSpeakingRef.current && !analyser) {
        target = 0.06 + 0.03 * (0.5 + 0.5 * Math.sin(t * 0.0015));
      } else if (!aiSpeakingRef.current) {
        target *= 0.25;
      }

      smooth = smooth * 0.88 + target * 0.12;
      energyRef.current = smooth;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(raf);
      detachAnalyser();
      energyRef.current = 0;
    };
  }, [enabled, remoteAudioElsRef]);

  return energyRef;
}
