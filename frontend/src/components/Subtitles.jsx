import React, { useEffect, useState, useRef } from 'react';

// Progressive subtitles that reveal words over time while AI is speaking
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
    <div className="w-full max-w-3xl bg-white/5 border border-white/10 backdrop-blur-md px-6 py-4 rounded-2xl">
      <div className="flex items-start gap-3">
        <span className="text-xs font-bold text-purple-300 uppercase mt-1">AI</span>
        <p className="flex-1 text-sm text-gray-100 leading-relaxed">{visibleText}</p>
      </div>
    </div>
  );
};

export default Subtitles;