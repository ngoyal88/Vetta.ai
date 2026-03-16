import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Frameless floating subtitles. Fixed ~30% from bottom, centered. AI text white 18px, word-by-word fade-in.
 */
const Subtitles = ({ text = '', isSpeaking = false, wpm = 180 }) => {
  const [visibleText, setVisibleText] = useState('');
  const words = useRef([]);
  const indexRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    words.current = (text || '').split(/\s+/).filter(Boolean);
    indexRef.current = 0;
    setVisibleText('');
    clearInterval(timerRef.current);

    if (!text) return;

    const msPerWord = Math.max(120, Math.round(60000 / wpm));

    if (isSpeaking) {
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
      setVisibleText(text);
    }

    return () => clearInterval(timerRef.current);
  }, [text, isSpeaking, wpm]);

  if (!text) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-[600px] px-4 text-center pointer-events-none z-20"
      style={{ bottom: '30%' }}
    >
      <p className="text-lg text-white leading-relaxed">
        {visibleText}
        {isSpeaking && visibleText.length < text.length && (
          <span className="inline-block w-1 h-5 bg-cyan-500 ml-0.5 align-middle animate-pulse" aria-hidden />
        )}
      </p>
    </motion.div>
  );
};

export default Subtitles;
