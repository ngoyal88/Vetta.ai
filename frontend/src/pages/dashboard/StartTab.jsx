import React from 'react';
import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';

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
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-900/50 border border-cyan-600/20 rounded-2xl p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <Rocket className="w-6 h-6 text-cyan-400" />
          <h2 className="text-2xl font-bold text-white">Configure Your Interview</h2>
        </div>

        {!currentUser?.emailVerified && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-200">
            Your email is not verified yet. You’ll need to verify before starting an interview.
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-3">Interview Type</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {interviewTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setInterviewType(type.value)}
                className={`p-4 rounded-xl border-2 transition text-left ${
                  interviewType === type.value
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-cyan-600/20 hover:border-cyan-600/40'
                }`}
              >
                <div className="text-3xl mb-2">{type.icon}</div>
                <div className="font-semibold text-white">{type.label}</div>
                <div className="text-xs text-gray-400 mt-1">{type.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {interviewType === 'custom' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6">
            <label className="block text-sm font-semibold text-gray-300 mb-2">Custom Role</label>
            <input
              type="text"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              placeholder="e.g., Senior DevOps Engineer, ML Engineer..."
              className="w-full p-3 bg-black/50 border-2 border-cyan-600/20 rounded-lg focus:border-cyan-500 focus:outline-none text-white placeholder-gray-500"
            />
          </motion.div>
        )}

        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-300 mb-3">Difficulty Level</label>
          <div className="grid grid-cols-3 gap-3">
            {['easy', 'medium', 'hard'].map((level) => (
              <button
                key={level}
                onClick={() => setDifficulty(level)}
                className={`p-4 rounded-lg border-2 transition font-medium ${
                  difficulty === level
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-cyan-600/20 hover:border-cyan-600/40 text-gray-400'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-300 mb-2">Years of Experience</label>
          <input
            type="number"
            min="0"
            max="40"
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            placeholder="e.g., 3"
            className="w-full p-3 bg-black/50 border-2 border-cyan-600/20 rounded-lg focus:border-cyan-500 focus:outline-none text-white placeholder-gray-500"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStartInterview}
          className="w-full py-4 btn-cyan text-lg flex items-center justify-center gap-3"
        >
          <Rocket className="w-6 h-6" />
          Start Interview
        </motion.button>
      </motion.div>
    </>
  );
}
