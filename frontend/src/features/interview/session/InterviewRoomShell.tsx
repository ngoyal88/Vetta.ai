import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { RemoteTrack } from "livekit-client";
import { AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

import { useConfirmDialog } from "shared/context/ConfirmDialogContext";
import type { CodeEditorHandle } from "features/interview/types";
import type { MicHealth } from "features/interview/preflight/MicHealthIndicator";
import { SessionBanner } from "./components/SessionBanner";
import { ReconnectOverlay } from "./components/ReconnectOverlay";
import { TextInputFallback } from "./components/TextInputFallback";
import SessionReportScreen from "features/interview/report/SessionReportScreen";
import VoiceInterviewStage from "features/interview/room/VoiceInterviewStage";
import CodingInterviewStage from "features/interview/room/CodingInterviewStage";
import { isCodingPhase, isCodingSession } from "features/interview/domain/modeContract";

type RemoteAudioMap = Map<string, { el: HTMLAudioElement; track: RemoteTrack }>;

export type RoomBanner = {
  id: number;
  type: string;
  message: string;
  autoDismissMs?: number | null;
};

export type InterviewRoomShellProps = {
  sessionId: string;
  onBack: () => void;
  connected: boolean;
  error: string | null;
  status: string;
  phase: string;
  currentQuestion: unknown;
  loadingNextProblem: boolean;
  transcriptInterim: string;
  transcriptFinal: string;
  aiText: string;
  aiFullText: string;
  aiSpeaking: boolean;
  feedback: unknown;
  micEnabled: boolean;
  micHealth: MicHealth;
  submitAnswer: () => void | Promise<void>;
  toggleMicrophone: (enabled: boolean) => void | Promise<void>;
  requestNextDSAQuestion: () => void;
  endInterview: () => void | Promise<void>;
  sendControl: (message: unknown) => void;
  codeEditorRef: RefObject<CodeEditorHandle | null>;
  remoteAudioElsRef: RefObject<RemoteAudioMap> | MutableRefObject<RemoteAudioMap>;
  endedExternally?: boolean;
  reconnecting?: boolean;
  reconnectAttempt?: number;
  silenceWarning?: { tier: number; secondsSilent: number; ending?: boolean } | null;
  sttFallbackActive?: boolean;
  banners?: RoomBanner[];
  onDismissBanner?: (id: number) => void;
  onReconnectGiveUp?: () => void;
  onFallbackToWebSocket?: () => void;
  disconnect?: () => void;
};

const pad2 = (n: number) => n.toString().padStart(2, "0");
const formatTimerHms = (s: number) => {
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)}`;
};
const formatTimerMmSs = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

const WS_FALLBACK_ERRORS = ["standard connection", "didn't connect", "Could not start"];

export default function InterviewRoomShell({
  sessionId,
  onBack,
  connected,
  error,
  status,
  phase,
  currentQuestion,
  loadingNextProblem,
  transcriptInterim,
  transcriptFinal,
  aiText,
  aiFullText,
  aiSpeaking,
  feedback,
  micEnabled,
  micHealth,
  submitAnswer,
  toggleMicrophone,
  requestNextDSAQuestion,
  endInterview,
  sendControl,
  codeEditorRef,
  remoteAudioElsRef,
  endedExternally = false,
  reconnecting = false,
  reconnectAttempt = 0,
  silenceWarning = null,
  sttFallbackActive = false,
  banners = [],
  onDismissBanner,
  onReconnectGiveUp,
  onFallbackToWebSocket,
  disconnect,
}: InterviewRoomShellProps) {
  const { confirmDialog } = useConfirmDialog();
  const storedType = sessionStorage.getItem(`interview_type_${sessionId}`);
  const codingSession = isCodingSession(storedType);
  const [interviewEnded, setInterviewEnded] = useState(false);

  useEffect(() => {
    if (endedExternally) setInterviewEnded(true);
  }, [endedExternally]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartedRef = useRef(false);

  useEffect(() => {
    const shouldRun =
      connected && (codingSession && isCodingPhase(phase) ? Boolean(currentQuestion) : true);
    if (!shouldRun || timerStartedRef.current) return undefined;
    timerStartedRef.current = true;
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return undefined;
  }, [connected, phase, currentQuestion, codingSession]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!interviewEnded) return undefined;
    if (!disconnect) return undefined;
    if (feedback) {
      disconnect();
      return undefined;
    }
    const timeoutId = window.setTimeout(() => disconnect(), 45000);
    return () => window.clearTimeout(timeoutId);
  }, [interviewEnded, feedback, disconnect]);

  const handleEndInterview = () => {
    confirmDialog({
      title: "End interview",
      message: "Are you sure you want to end this session?",
      destructive: true,
      onConfirm: () => {
        setInterviewEnded(true);
        void endInterview();
      },
    });
  };

  if (interviewEnded) {
    return (
      <SessionReportScreen feedback={feedback as never} sessionId={sessionId} onBack={onBack} />
    );
  }

  const showCodingRoom = codingSession && isCodingPhase(phase);
  const showWsFallback =
    Boolean(onFallbackToWebSocket) &&
    Boolean(error) &&
    WS_FALLBACK_ERRORS.some((fragment) => error!.includes(fragment));

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-0)]">
      {error ? (
        <div role="alert" aria-live="assertive" className="sr-only">
          {error}
        </div>
      ) : null}

      {showWsFallback ? (
        <div className="ir-room__fallback shrink-0 px-4 py-2 border-b border-yellow-500/30 bg-yellow-500/5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-300 truncate">{error}</p>
          </div>
          <button type="button" onClick={onFallbackToWebSocket} className="shrink-0 btn-ghost text-xs h-7">
            Use standard connection
          </button>
        </div>
      ) : null}

      {banners.map((b) => (
        <SessionBanner
          key={b.id}
          type={b.type}
          message={b.message}
          autoDismissMs={b.autoDismissMs}
          onDismiss={() => onDismissBanner?.(b.id)}
        />
      ))}

      {reconnecting && onReconnectGiveUp ? (
        <ReconnectOverlay attempt={reconnectAttempt} onGiveUp={onReconnectGiveUp} />
      ) : null}

      {sttFallbackActive ? (
        <TextInputFallback onSubmit={(text) => sendControl({ type: "text_answer", text })} />
      ) : null}

      {!showCodingRoom ? (
        <div className="ir-room flex-1 min-h-0">
          <VoiceInterviewStage
            connected={connected}
            reconnecting={reconnecting}
            timer={formatTimerHms(elapsedSeconds)}
            status={status || "listening"}
            phase={phase}
            aiSpeaking={aiSpeaking}
            aiFullText={aiFullText || aiText}
            transcriptFinal={transcriptFinal}
            transcriptInterim={transcriptInterim}
            micEnabled={micEnabled}
            silenceWarning={silenceWarning}
            remoteAudioElsRef={remoteAudioElsRef}
            onToggleMic={toggleMicrophone}
            onSubmitAnswer={submitAnswer}
            onEndInterview={handleEndInterview}
          />
        </div>
      ) : (
        <CodingInterviewStage
          sessionId={sessionId}
          timer={formatTimerMmSs(elapsedSeconds)}
          status={status || "listening"}
          aiSpeaking={aiSpeaking}
          aiFullText={aiFullText || aiText}
          transcriptFinal={transcriptFinal}
          transcriptInterim={transcriptInterim}
          micEnabled={micEnabled}
          micHealth={micHealth}
          connected={connected}
          currentQuestion={(currentQuestion as Record<string, unknown> | null) ?? null}
          loadingNextProblem={loadingNextProblem}
          codeEditorRef={codeEditorRef}
          sendControl={sendControl}
          onToggleMic={toggleMicrophone}
          onRequestNextQuestion={requestNextDSAQuestion}
          onEndInterview={handleEndInterview}
        />
      )}
    </div>
  );
}
