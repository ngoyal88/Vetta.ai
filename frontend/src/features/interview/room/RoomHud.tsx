type Props = {
  connected: boolean;
  timer: string;
  reconnecting?: boolean;
};

export default function RoomHud({ connected, timer, reconnecting = false }: Props) {
  const label = reconnecting
    ? "Reconnecting"
    : connected
      ? "Secure Connection"
      : "Connecting";

  return (
    <header className="ir-hud">
      <div
        className={`ir-hud__chip glass-panel ${connected && !reconnecting ? "ir-hud__chip--live" : ""}`}
      >
        <span
          className={`ir-hud__dot ${connected && !reconnecting ? "ir-hud__dot--live" : "ir-hud__dot--warn"}`}
          aria-hidden
        />
        <span className="ir-hud__label">{label}</span>
      </div>
      <div className="ir-hud__chip glass-panel" aria-live="polite">
        <span className="ir-hud__timer">{timer}</span>
      </div>
    </header>
  );
}
