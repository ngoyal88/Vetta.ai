import { useCallback, useEffect, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { RemoteTrack } from "livekit-client";
import toast from "react-hot-toast";

import { useAgentAudioEnergy } from "features/interview/session/hooks/useAgentAudioEnergy";
import { useLocalCameraPreview } from "features/interview/preflight/useLocalCameraPreview";
import { useSessionLogTurns } from "features/interview/session/hooks/useSessionLogTurns";
import AgentNeuralOrb from "features/interview/room/AgentNeuralOrb";
import RoomHud from "features/interview/room/RoomHud";
import SessionLogPanel from "features/interview/room/SessionLogPanel";
import SelfViewPip from "features/interview/room/SelfViewPip";
import RoomControlDock from "features/interview/room/RoomControlDock";
import SilenceIndicator from "./SilenceIndicator";
import "features/interview/room/interview-room.css";

type RemoteAudioMap = Map<string, { el: HTMLAudioElement; track: RemoteTrack }>;

type Props = {
  connected: boolean;
  reconnecting?: boolean;
  timer: string;
  status: string;
  phase: string;
  aiSpeaking: boolean;
  aiFullText: string;
  transcriptFinal: string;
  transcriptInterim: string;
  micEnabled: boolean;
  silenceWarning?: { tier: number; secondsSilent: number } | null;
  remoteAudioElsRef: RefObject<RemoteAudioMap> | MutableRefObject<RemoteAudioMap>;
  onToggleMic: (enabled: boolean) => void;
  onSubmitAnswer: () => void;
  onEndInterview: () => void;
};

export default function VoiceInterviewStage({
  connected,
  reconnecting = false,
  timer,
  status,
  phase,
  aiSpeaking,
  aiFullText,
  transcriptFinal,
  transcriptInterim,
  micEnabled,
  silenceWarning,
  remoteAudioElsRef,
  onToggleMic,
  onSubmitAnswer,
  onEndInterview,
}: Props) {
  const [logOpen, setLogOpen] = useState(true);
  const energyRef = useAgentAudioEnergy(remoteAudioElsRef, aiSpeaking, true);
  const turns = useSessionLogTurns({
    aiFullText,
    aiSpeaking,
    transcriptFinal,
    transcriptInterim,
  });
  const camera = useLocalCameraPreview(false);

  useEffect(() => {
    if (camera.errorMessage) toast.error(camera.errorMessage);
  }, [camera.errorMessage]);

  const toggleCamera = useCallback(() => {
    if (camera.isLive) {
      camera.stop();
      return;
    }
    void camera.start();
  }, [camera.isLive, camera.start, camera.stop]);

  return (
    <div className="ir-stage">
      <RoomHud connected={connected} reconnecting={reconnecting} timer={timer} />

      {silenceWarning ? (
        <div className="ir-silence">
          <SilenceIndicator
            tier={silenceWarning.tier}
            secondsSilent={silenceWarning.secondsSilent}
          />
        </div>
      ) : null}

      <div className={`ir-canvas ${aiSpeaking ? "ir-canvas--speaking" : ""}`}>
        <div className="ir-canvas__atmosphere" aria-hidden />
        <div className="ir-canvas__vignette" aria-hidden />
        <AgentNeuralOrb energyRef={energyRef} aiSpeaking={aiSpeaking} status={status} />
      </div>

      <SessionLogPanel
        turns={turns}
        open={logOpen}
        onClose={() => setLogOpen(false)}
      />

      <SelfViewPip
        videoRef={camera.videoRef}
        visible={camera.isLive}
        micEnabled={micEnabled}
      />

      <RoomControlDock
        micEnabled={micEnabled}
        cameraOn={camera.isLive}
        aiSpeaking={aiSpeaking}
        connected={connected}
        phase={phase}
        logOpen={logOpen}
        onToggleMic={onToggleMic}
        onToggleCamera={toggleCamera}
        onSubmitAnswer={onSubmitAnswer}
        onEndInterview={onEndInterview}
        onToggleLog={() => setLogOpen((v) => !v)}
      />
    </div>
  );
}
