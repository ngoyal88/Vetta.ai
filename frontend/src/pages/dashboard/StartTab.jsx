import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';

const DIFFICULTY_BARS = { easy: 1, medium: 3, hard: 5 };

export default function StartTab({
  currentUser,
  interviewTypes,
  interviewType,
  setInterviewType,
  customRole,
  setCustomRole,
  difficulty,
  setDifficulty,
  yearsExperience,
  setYearsExperience,
  handleStartInterview,
}) {
  const [hoverStart, setHoverStart] = useState(false);

  return (
    <div className="max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-raised border border-[var(--border-subtle)] p-6 md:p-8"
      >
        {!currentUser?.emailVerified && (
          <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
            Email not verified. You can still start an interview; verifying helps with account recovery.
          </div>
        )}

        {/* Interview type: horizontal pill tabs */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-400 mb-3">Interview type</label>
          <div className="flex flex-wrap gap-2">
            {interviewTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setInterviewType(type.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors duration-150 ${
                  interviewType === type.value
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                    : 'border-[var(--border-subtle)] text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {interviewType === 'custom' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6">
            <label className="block text-sm font-medium text-zinc-400 mb-2">Custom role</label>
            <input
              type="text"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              placeholder="e.g. Senior DevOps Engineer"
              className="input-base w-full"
            />
          </motion.div>
        )}

        {/* Difficulty: 1 / 3 / 5 bars */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-400 mb-3">Difficulty</label>
          <div className="grid grid-cols-3 gap-3">
            {(['easy', 'medium', 'hard']).map((level) => {
              const bars = DIFFICULTY_BARS[level];
              const active = difficulty === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`p-4 rounded-xl border transition-all duration-150 text-left ${
                    active
                      ? 'border-cyan-500/50 bg-cyan-500/5'
                      : 'border-[var(--border-subtle)] hover:border-zinc-600'
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`w-1.5 rounded-full transition-colors ${
                          i <= bars ? (active ? 'bg-cyan-500' : 'bg-zinc-600') : 'bg-transparent'
                        }`}
                        style={{ height: 6 + i * 2 }}
                      />
                    ))}
                  </div>
                  <span className={`text-sm font-medium ${active ? 'text-cyan-400' : 'text-zinc-500'}`}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-zinc-400 mb-2">Years of experience (optional)</label>
          <input
            type="number"
            min="0"
            max="40"
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            placeholder="e.g. 3"
            className="input-base w-full"
          />
        </div>

        {/* Start button: full-width, dark bg, border glow on hover */}
        <motion.button
          type="button"
          onHoverStart={() => setHoverStart(true)}
          onHoverEnd={() => setHoverStart(false)}
          whileTap={{ scale: 0.99 }}
          onClick={handleStartInterview}
          className="w-full h-10 rounded-lg bg-overlay border flex items-center justify-center gap-2 text-white font-medium transition-all duration-150"
          style={{
            borderColor: hoverStart ? 'rgba(6, 182, 212, 0.5)' : 'var(--border-subtle)',
            boxShadow: hoverStart ? '0 0 24px rgba(6, 182, 212, 0.2)' : 'none',
          }}
        >
          <Mic className="w-4 h-4" />
          Start Interview
        </motion.button>

        {/* Mini preview */}
        <div className="mt-8 rounded-xl bg-overlay border border-[var(--border-subtle)] p-4 aspect-video flex items-center justify-center">
          <p className="text-zinc-600 text-sm">Interview room preview</p>
        </div>
      </motion.div>
    </div>
  );
}
