import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const AIAvatar = ({ isSpeaking, currentQuestion }) => {

  // Helper: Parses the AI response to show ONLY the question text
  const processQuestion = (data) => {
    if (!data) return null;

    // 1. Handle DSA Object (It's already clean JSON)
    if (typeof data === 'object') {
      return data.title 
        ? `**${data.title}**\n\n${data.description}` 
        : "Coding Challenge Started";
    }

    // 2. Handle String (Behavioral/Technical Question)
    if (typeof data === 'string') {
      // The AI returns: "Question: ... \nKey Points: ... \nRed Flags: ..."
      // We want to DELETE everything after "Key Points" or "Red Flags"
      
      let cleanText = data;

      // Remove "Question:" prefix if it exists
      cleanText = cleanText.replace(/^Question:\s*/i, '');

      // Cut off at "Key Points" or "Red Flags"
      const splitMarkers = ["Key Points to Cover:", "Key Points:", "Red Flags:"];
      
      for (const marker of splitMarkers) {
        if (cleanText.includes(marker)) {
          cleanText = cleanText.split(marker)[0];
        }
      }

      return cleanText.trim();
    }

    return null;
  };

  const displayContent = processQuestion(currentQuestion);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-4xl mx-auto px-4">
      {/* Animated Orb */}
      <motion.div
        className="relative w-48 h-48 mb-8 flex-shrink-0"
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
        className="text-center mb-6 flex-shrink-0"
      >
        <h2 className="text-2xl font-bold text-white mb-2">AI Interviewer</h2>
        <p className="text-gray-400">
          {isSpeaking ? 'Speaking...' : 'Listening...'}
        </p>
      </motion.div>
      
      {/* Question Display Card */}
      {displayContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl overflow-y-auto max-h-[40vh]"
        >
          {/* React Markdown renders the bolding and lists correctly */}
          <div className="prose prose-invert max-w-none text-white leading-relaxed">
            <ReactMarkdown
              components={{
                // Override default styles if needed
                strong: ({node, ...props}) => <span className="font-bold text-blue-300" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                li: ({node, ...props}) => <li className="text-gray-200" {...props} />,
                p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AIAvatar;