import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Progressive subtitles that reveal words over time while AI is speaking
 * Styled to match the cyan/white color scheme
 */
const Subtitles = ({ text = '', isSpeaking = false, wpm = 180 }) => {
  const [visibleText, setVisibleText] = useState('');
  const words = useRef([]);
  const indexRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    // Reset when text changes
    words.current = (text || '').split(/\s+/).filter(Boolean);
    indexRef.current = 0;
    setVisibleText('');
    clearInterval(timerRef.current);

    if (!text) return;

    // Estimated interval based on words-per-minute
    const msPerWord = Math.max(120, Math.round(60000 / wpm));

    if (isSpeaking) {
      // Progressive reveal word by word
      timerRef.current = setInterval(() => {
        const i = indexRef.current;
        if (i < words.current.length) {
          indexRef.current += 1;
          setVisibleText((prev) => (prev ? prev + ' ' : '') + words.current[i]);
        } else {
          clearInterval(timerRef.current);
        }
      }, msPerWord);
    } else {
      // If not speaking, reveal all immediately
      setVisibleText(text);
    }

    return () => clearInterval(timerRef.current);
  }, [text, isSpeaking, wpm]);

  if (!text) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full bg-cyan-500/10 border border-cyan-500/30 backdrop-blur-md px-6 py-4 rounded-2xl shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="text-xs font-bold text-cyan-400 uppercase mt-1 flex-shrink-0">
          AI
        </span>
        <div className="flex-1">
          <p className="text-sm text-gray-100 leading-relaxed">
            {visibleText}
            {isSpeaking && visibleText.length < text.length && (
              <span className="inline-block w-1 h-4 bg-cyan-400 ml-1 animate-pulse" />
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default Subtitles;