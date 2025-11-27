import React from 'react';
import { motion } from 'framer-motion';

const AIAvatar = ({ isSpeaking, currentQuestion }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Animated Orb */}
      <motion.div
        className="relative w-48 h-48 mb-8"
        animate={isSpeaking ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {/* Outer glow */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-2xl opacity-60"
          animate={isSpeaking ? { opacity: [0.4, 0.8, 0.4] } : { opacity: 0.3 }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        
        {/* Inner orb */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
          <motion.div
            className="w-32 h-32 rounded-full bg-gradient-to-br from-white/20 to-transparent backdrop-blur-sm"
            animate={isSpeaking ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </div>
        
        {/* Speaking waves */}
        {isSpeaking && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute w-full h-full rounded-full border-2 border-white/30"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.6
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
      
      {/* AI Label */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold text-white mb-2">AI Interviewer</h2>
        <p className="text-gray-400">
          {isSpeaking ? 'Speaking...' : 'Listening...'}
        </p>
      </motion.div>
      
      {/* Current Question Display */}
      {currentQuestion && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 max-w-2xl bg-black/30 backdrop-blur-md p-6 rounded-2xl border border-white/10"
        >
          <p className="text-white text-lg leading-relaxed">
            {currentQuestion}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default AIAvatar;