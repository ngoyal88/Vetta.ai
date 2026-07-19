import React from "react";

export type MicHealth = "ok" | "quiet" | "no_signal" | "reconnecting";

type MicHealthIndicatorProps = {
  health: MicHealth;
};

const LABELS: Record<MicHealth, string> = {
  ok: "mic ok",
  quiet: "mic quiet",
  no_signal: "no mic signal",
  reconnecting: "voice reconnecting",
};

const COLORS: Record<MicHealth, string> = {
  ok: "bg-emerald",
  quiet: "bg-amber-400",
  no_signal: "bg-red-400",
  reconnecting: "bg-amber-400",
};

export default function MicHealthIndicator({ health }: MicHealthIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5" title={LABELS[health]} aria-label={LABELS[health]}>
      <span className={`w-[5px] h-[5px] rounded-full ${COLORS[health]}`} aria-hidden />
      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{LABELS[health]}</span>
    </div>
  );
}
