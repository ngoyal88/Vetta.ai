import React from 'react';
import { motion } from 'framer-motion';
import { Mic, SkipForward, LogOut, Code, ChevronRight, Timer } from 'lucide-react';

const difficultyColors = {
  easy: "bg-green-900/50 text-green-300 border-green-700/60",
  medium: "bg-yellow-900/50 text-yellow-300 border-yellow-700/60",
  hard: "bg-red-900/50 text-red-300 border-red-700/60",
};

export default function InterviewRoomHeader(props) {
  const { connected, phase, onSkip, onEndInterview, loadingNextProblem, timer, difficulty } = props;
  const isDSA = phase === 'dsa';

  return (
    <header className="relative z-10 px-6 py-3 bg-black/80 backdrop-blur-md border-b border-cyan-600/20">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
        {/* Left: connection + phase + difficulty + timer */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2" aria-live="polite" aria-atomic="true">
            <div className={"w-2 h-2 rounded-full " + (connected ? "bg-cyan-400 animate-pulse" : "bg-red-500")} aria-hidden />
            <span className="text-xs font-medium text-gray-400" id="connection-status">
              {connected ? "Connected" : "Connecting…"}
            </span>
          </div>

          <div className="h-4 w-px bg-gray-700" aria-hidden />

          <div className="flex items-center gap-2 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg" role="status" aria-live="polite">
            {isDSA ? <Code className="w-3.5 h-3.5 text-cyan-400" aria-hidden /> : <Mic className="w-3.5 h-3.5 text-cyan-400" aria-hidden />}
            <span className="text-xs font-semibold text-cyan-400">{isDSA ? "Coding Round" : "Interview"}</span>
          </div>

          {isDSA && difficulty && (
            <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold border ${difficultyColors[difficulty] || "bg-gray-700 text-gray-300 border-gray-600"}`}>
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </span>
          )}

          {isDSA && timer && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-lg">
              <Timer className="w-3.5 h-3.5 text-gray-400" aria-hidden />
              <span className="text-xs font-mono font-semibold text-gray-300 tabular-nums">{timer}</span>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: isDSA && loadingNextProblem ? 1 : 1.05 }}
            whileTap={{ scale: isDSA && loadingNextProblem ? 1 : 0.95 }}
            onClick={onSkip}
            disabled={isDSA && loadingNextProblem}
            className={
              "px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black transition " +
              (isDSA
                ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20") +
              (isDSA && loadingNextProblem ? " opacity-50 cursor-not-allowed" : "")
            }
            aria-label={isDSA ? "Next problem" : "Skip to next question"}
          >
            {isDSA
              ? <><ChevronRight className="w-3.5 h-3.5" aria-hidden /> {loadingNextProblem ? 'Loading...' : 'Next problem'}</>
              : <><SkipForward className="w-3.5 h-3.5" aria-hidden /> Skip</>
            }
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEndInterview}
            className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition text-xs font-medium flex items-center gap-1.5 focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black"
            aria-label="End interview"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden /> End
          </motion.button>
        </div>
      </div>
    </header>
  );
}
