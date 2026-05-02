import React from 'react';
import { Mic, SkipForward, LogOut, Code2, ChevronRight, Timer } from 'lucide-react';

const DIFF_COLORS = {
  easy:   'text-emerald border-l-emerald',
  medium: 'text-yellow-400 border-l-yellow-400',
  hard:   'text-red-400 border-l-red-400',
};

export default function InterviewRoomHeader({ connected, phase, onSkip, onEndInterview, loadingNextProblem, timer, difficulty, transport }) {
  const isDSA = phase === 'dsa';

  return (
    <header className="h-11 shrink-0 px-4 flex items-center justify-between border-b border-[var(--border)] bg-raised z-10">
      {/* Left: breadcrumb path */}
      <div className="filepath flex items-center gap-0">
        <span className="segment">~/interviews</span>
        <span className="sep">/</span>
        <span className="active-segment">active-session</span>
        {isDSA && <span className="sep">/</span>}
        {isDSA && <span className="segment">dsa</span>}
      </div>

      {/* Center: status chips */}
      <div className="flex items-center gap-3" aria-live="polite">
        {/* Connection */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-[5px] h-[5px] rounded-full ${connected ? 'bg-emerald' : 'bg-red-400'}`}
            style={connected ? { boxShadow: '0 0 6px #10B981' } : {}}
            aria-hidden
          />
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
            {connected ? 'connected' : 'connecting…'}
          </span>
        </div>

        <span className="text-[var(--border)] text-xs">|</span>

        {/* Phase */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--bg-overlay)]">
          {isDSA
            ? <Code2 size={10} className="text-indigo" aria-hidden />
            : <Mic size={10} className="text-indigo" aria-hidden />}
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            {isDSA ? 'coding' : 'behavioral'}
          </span>
        </div>

        {/* Difficulty */}
        {isDSA && difficulty && (
          <span className={`font-mono text-[10px] pl-2 border-l-2 ${DIFF_COLORS[difficulty] || 'text-[var(--text-tertiary)] border-l-[var(--border)]'}`}>
            {difficulty}
          </span>
        )}

        {/* Timer */}
        {isDSA && timer && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-tertiary)] tabular-nums">
            <Timer size={9} aria-hidden />
            {timer}
          </div>
        )}

        {/* Transport badge */}
        {transport && (
          <>
            <span className="text-[var(--border)] text-xs">|</span>
            <span className="font-mono text-[10px] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded-sm border border-[var(--border)]">
              {transport}
            </span>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSkip}
          disabled={isDSA && loadingNextProblem}
          className="flex items-center gap-1 h-7 px-2.5 rounded-sm border border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--indigo-border)] hover:text-[var(--text-secondary)] hover:bg-[var(--indigo-dim)] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[10px]"
          aria-label={isDSA ? 'Next problem' : 'Skip question'}
        >
          {isDSA ? <ChevronRight size={11} /> : <SkipForward size={11} />}
          <span>{isDSA ? 'next' : 'skip'}</span>
        </button>

        <button
          type="button"
          onClick={onEndInterview}
          className="flex items-center gap-1 h-7 px-2.5 rounded-sm border border-[var(--border)] text-[var(--text-tertiary)] hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-100 font-mono text-[10px]"
          aria-label="End interview"
        >
          <LogOut size={11} />
          <span>end</span>
        </button>
      </div>
    </header>
  );
}