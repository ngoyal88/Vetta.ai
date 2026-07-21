import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Send,
  ScrollText,
} from "lucide-react";

type Props = {
  micEnabled: boolean;
  cameraOn?: boolean;
  aiSpeaking: boolean;
  connected?: boolean;
  phase: string;
  logOpen?: boolean;
  showCamera?: boolean;
  showLog?: boolean;
  onToggleMic: (enabled: boolean) => void;
  onToggleCamera?: () => void;
  onSubmitAnswer: () => void;
  onEndInterview: () => void;
  onToggleLog?: () => void;
};

/** Dock: mic · camera · log · submit | end — no stub controls. */
export default function RoomControlDock({
  micEnabled,
  cameraOn = false,
  aiSpeaking,
  connected = true,
  phase,
  logOpen = false,
  showCamera = true,
  showLog = true,
  onToggleMic,
  onToggleCamera,
  onSubmitAnswer,
  onEndInterview,
  onToggleLog,
}: Props) {
  const submitDisabled = phase === "greeting" || aiSpeaking || !connected;

  return (
    <footer className="ir-dock glass-panel" role="toolbar" aria-label="Interview controls">
      <div className="ir-dock__row">
        <button
          type="button"
          className={`ir-dock__btn ir-dock__btn--primary ${micEnabled ? "" : "ir-dock__btn--muted"}`}
          title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
          onClick={() => onToggleMic(!micEnabled)}
        >
          {micEnabled ? <Mic size={20} aria-hidden /> : <MicOff size={20} aria-hidden />}
        </button>

        {showCamera && (
          <button
            type="button"
            className="ir-dock__btn ir-dock__btn--solid"
            title={cameraOn ? "Turn camera off" : "Turn camera on"}
            aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
            onClick={onToggleCamera}
          >
            {cameraOn ? <Video size={20} aria-hidden /> : <VideoOff size={20} aria-hidden />}
          </button>
        )}

        {showLog && (
          <button
            type="button"
            className={`ir-dock__btn ${logOpen ? "ir-dock__btn--active" : ""}`}
            title={logOpen ? "Hide session log" : "Show session log"}
            aria-label={logOpen ? "Hide session log" : "Show session log"}
            onClick={onToggleLog}
          >
            <ScrollText size={20} aria-hidden />
          </button>
        )}

        <button
          type="button"
          className="ir-dock__btn ir-dock__btn--solid"
          title="I'm done — submit answer"
          aria-label={
            submitDisabled
              ? "Wait for AI to finish or connect"
              : "I'm done, submit answer"
          }
          disabled={submitDisabled}
          onClick={onSubmitAnswer}
        >
          <Send size={18} aria-hidden />
        </button>

        <span className="ir-dock__divider" aria-hidden />

        <button
          type="button"
          className="ir-dock__btn ir-dock__btn--end"
          title="End interview"
          aria-label="End interview"
          onClick={onEndInterview}
        >
          <PhoneOff size={20} aria-hidden />
        </button>
      </div>
    </footer>
  );
}
