import { useRef, useState } from "react";
import type { RemoteTrack } from "livekit-client";
import { useNavigate, useParams } from "react-router-dom";

import type { CodeEditorHandle } from "features/interview/types";
import { useInterviewTransport } from "features/interview/session/hooks/useInterviewTransport";
import { useInterviewLiveKitAdapter } from "features/interview/session/hooks/livekit/useInterviewLiveKitAdapter";
import { useInterviewWebSocketAdapter } from "features/interview/session/hooks/websocket/useInterviewWebSocketAdapter";
import { isCodingSession } from "features/interview/domain/modeContract";
import InterviewRoomShell, { type RoomBanner } from "features/interview/session/InterviewRoomShell";

type RemoteAudioMap = Map<string, { el: HTMLAudioElement; track: RemoteTrack }>;

function resolveInitialPhase(sessionId: string): string {
  const storedType = sessionStorage.getItem(`interview_type_${sessionId}`);
  return isCodingSession(storedType) ? "coding" : "behavioral";
}

function LiveKitRoomBridge({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [endedExternally, setEndedExternally] = useState(false);
  const [banners, setBanners] = useState<RoomBanner[]>([]);
  const addBanner = (type: string, message: string, autoDismissMs: number | null = null) => {
    const id = Date.now();
    setBanners((prev) => [...prev, { id, type, message, autoDismissMs }]);
    return id;
  };
  const removeBanner = (id: number) => setBanners((prev) => prev.filter((b) => b.id !== id));
  const removeBannerByType = (type: string) =>
    setBanners((prev) => prev.filter((b) => b.type !== type));

  const codeEditorRef = useRef<CodeEditorHandle | null>(null);

  const adapter = useInterviewLiveKitAdapter(sessionId, resolveInitialPhase(sessionId), {
    addBanner,
    removeBanner,
    removeBannerByType,
    codeEditorRef,
    onInterviewEnded: () => setEndedExternally(true),
  });

  return (
    <InterviewRoomShell
      sessionId={sessionId}
      onBack={onBack}
      connected={adapter.connected}
      error={adapter.error}
      status={adapter.status}
      phase={adapter.phase}
      currentQuestion={adapter.currentQuestion}
      loadingNextProblem={adapter.loadingNextProblem}
      transcriptInterim={adapter.transcriptInterim}
      transcriptFinal={adapter.transcriptFinal}
      aiText={adapter.aiText}
      aiFullText={adapter.aiFullText}
      aiSpeaking={adapter.aiSpeaking}
      feedback={adapter.feedback}
      micEnabled={adapter.micEnabled}
      micHealth={adapter.micHealth}
      submitAnswer={adapter.submitAnswer}
      toggleMicrophone={adapter.toggleMicrophone}
      requestNextDSAQuestion={adapter.requestNextDSAQuestion}
      endInterview={adapter.endInterview}
      sendControl={adapter.sendControl}
      codeEditorRef={codeEditorRef}
      remoteAudioElsRef={adapter.remoteAudioElsRef}
      endedExternally={endedExternally}
      reconnecting={adapter.reconnecting}
      reconnectAttempt={adapter.reconnectAttempt}
      silenceWarning={adapter.silenceWarning}
      sttFallbackActive={adapter.sttFallbackActive}
      banners={banners}
      onDismissBanner={removeBanner}
      disconnect={adapter.disconnect}
      onFallbackToWebSocket={adapter.fallbackToWebSocket}
      onReconnectGiveUp={() => {
        adapter.disconnect();
        void adapter.endInterview();
        onBack();
      }}
    />
  );
}

function WebSocketRoomBridge({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [endedExternally, setEndedExternally] = useState(false);
  const codeEditorRef = useRef<CodeEditorHandle | null>(null);
  const remoteAudioElsRef = useRef<RemoteAudioMap>(new Map());

  const adapter = useInterviewWebSocketAdapter(sessionId, resolveInitialPhase(sessionId), {
    onInterviewEnded: () => setEndedExternally(true),
  });

  return (
    <InterviewRoomShell
      sessionId={sessionId}
      onBack={onBack}
      connected={adapter.connected}
      error={adapter.error}
      status={adapter.status}
      phase={adapter.phase}
      currentQuestion={adapter.currentQuestion}
      loadingNextProblem={adapter.loadingNextProblem}
      transcriptInterim={adapter.transcriptInterim}
      transcriptFinal={adapter.transcriptFinal}
      aiText={adapter.aiText}
      aiFullText={adapter.aiFullText}
      aiSpeaking={adapter.aiSpeaking}
      feedback={adapter.feedback}
      micEnabled={adapter.micEnabled}
      micHealth="ok"
      submitAnswer={adapter.submitAnswer}
      toggleMicrophone={adapter.toggleMicrophone}
      requestNextDSAQuestion={adapter.requestNextDSAQuestion}
      endInterview={adapter.endInterview}
      sendControl={adapter.sendMessage}
      codeEditorRef={codeEditorRef}
      remoteAudioElsRef={remoteAudioElsRef}
      endedExternally={endedExternally}
      disconnect={adapter.disconnect}
    />
  );
}

export default function InterviewRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const useLiveKit = useInterviewTransport();

  if (!sessionId) return null;

  const onBack = () => navigate("/dashboard");

  return useLiveKit ? (
    <LiveKitRoomBridge sessionId={sessionId} onBack={onBack} />
  ) : (
    <WebSocketRoomBridge sessionId={sessionId} onBack={onBack} />
  );
}
