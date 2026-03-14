import React from 'react';
import { motion } from 'framer-motion';
import { Mic, SkipForward, LogOut, Code, ChevronRight, Timer } from 'lucide-react';

const difficultyColors = {
  easy: 'border-l-green-500',
  medium: 'border-l-yellow-500',
  hard: 'border-l-red-500',
};

export default function InterviewRoomHeader(props) {
  const { connected, phase, onSkip, onEndInterview, loadingNextProblem, timer, difficulty, transport } = props;
  const isDSA = phase === 'dsa';

  return (
    <header className="relative z-10 px-4 py-2 bg-base border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2" aria-live="polite" aria-atomic="true">
            <div
              className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-cyan-500' : 'bg-red-500'}`}
              aria-hidden
            />
            <span className="text-xs text-zinc-500">{connected ? 'Connected' : 'Connecting…'}</span>
          </div>
          {transport && (
            <>
              <div className="h-3 w-px bg-[var(--border-subtle)]" aria-hidden />
              <span
                className="text-xs px-2 py-0.5 rounded bg-overlay border border-[var(--border-subtle)] text-zinc-400"
                title={`Transport: ${transport}`}
              >
                {transport}
              </span>
            </>
          )}
          <div className="h-3 w-px bg-[var(--border-subtle)]" aria-hidden />
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[var(--border-subtle)]" role="status">
            {isDSA ? <Code className="w-3 h-3 text-cyan-500" aria-hidden /> : <Mic className="w-3 h-3 text-cyan-500" aria-hidden />}
            <span className="text-xs text-zinc-400">{isDSA ? 'Coding' : 'Interview'}</span>
          </div>
          {isDSA && difficulty && (
            <span className={`text-xs pl-2 border-l-2 ${difficultyColors[difficulty] || 'border-l-zinc-600'} text-zinc-400`}>
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </span>
          )}
          {isDSA && timer && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs text-zinc-500 tabular-nums">
              <Timer className="w-3 h-3" aria-hidden />
              {timer}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            type="button"
            whileHover={loadingNextProblem ? {} : { scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onSkip}
            disabled={isDSA && loadingNextProblem}
            className={
              'p-2 rounded-lg text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
              (isDSA ? 'hover:bg-overlay' : 'hover:bg-overlay')
            }
            aria-label={isDSA ? 'Next problem' : 'Skip'}
          >
            {isDSA ? <ChevronRight className="w-4 h-4" /> : <SkipForward className="w-4 h-4" />}
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onEndInterview}
            className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-overlay transition-colors"
            aria-label="End interview"
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </header>
  );
}
