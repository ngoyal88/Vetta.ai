import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LiveTranscription = ({ transcriptions = [] }) => {
  // Show last 3 transcriptions
  const recentTranscriptions = transcriptions.slice(-3);
  
  return (
    <div className="fixed bottom-24 left-0 right-0 flex flex-col items-center gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {recentTranscriptions.map((trans, index) => (
          <motion.div
            key={trans.timestamp || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`max-w-3xl w-full p-4 rounded-2xl backdrop-blur-md border ${
              trans.speaker === 'candidate'
                ? 'bg-blue-500/20 border-blue-500/30 text-blue-100'
                : 'bg-purple-500/20 border-purple-500/30 text-purple-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xs font-semibold uppercase">
                {trans.speaker === 'candidate' ? '🎤 You' : '🤖 AI'}
              </span>
              <p className="flex-1 text-sm">{trans.text}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default LiveTranscription;