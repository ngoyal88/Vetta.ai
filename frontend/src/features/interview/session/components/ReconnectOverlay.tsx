type ReconnectOverlayProps = {
  attempt: number;
  onGiveUp: () => void;
};

export function ReconnectOverlay({ attempt, onGiveUp }: ReconnectOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="max-w-sm mx-4 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin mx-auto mb-4" />
        <h3 className="text-[var(--color-on-surface)] font-semibold mb-2">Connection lost</h3>
        <p className="text-[var(--color-outline)] text-sm mb-1">
          Trying to reconnect... (attempt {attempt} of 3)
        </p>
        <p className="text-[var(--color-outline)] text-xs mb-6 opacity-70">
          Your progress is saved. Do not close this tab.
        </p>
        <button
          type="button"
          onClick={onGiveUp}
          className="text-xs text-[var(--color-outline)] hover:text-[var(--color-on-surface-variant)] underline"
        >
          End session and save progress
        </button>
      </div>
    </div>
  );
}
