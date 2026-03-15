import React from "react";

export function ReconnectOverlay({ attempt, onGiveUp }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="max-w-sm mx-4 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mx-auto mb-4" />
        <h3 className="text-white font-semibold mb-2">Connection lost</h3>
        <p className="text-zinc-400 text-sm mb-1">
          Trying to reconnect... (attempt {attempt} of 3)
        </p>
        <p className="text-zinc-600 text-xs mb-6">
          Your progress is saved. Do not close this tab.
        </p>
        <button
          type="button"
          onClick={onGiveUp}
          className="text-xs text-zinc-500 hover:text-zinc-300 underline"
        >
          End session and save progress
        </button>
      </div>
    </div>
  );
}
