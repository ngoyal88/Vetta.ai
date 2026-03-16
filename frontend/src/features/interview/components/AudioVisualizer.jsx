import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const BAR_COUNT = 7;
const IDLE_SCALES = [0.4, 0.55, 0.7, 0.5, 0.65, 0.45, 0.6];

/**
 * 7-bar waveform. Idle: CSS breathing. Speaking: heights from audioLevel.
 * Pure React/CSS, no Three.js.
 */
const AudioVisualizer = ({ isSpeaking = false, audioLevel = 0 }) => {
  const reducedMotion = useReducedMotion();
  const activeScale = isSpeaking && audioLevel > 0 ? Math.min(0.5 + audioLevel * 0.6, 1) : 0;

  return (
    <div className="w-full h-full flex items-center justify-center bg-transparent" aria-hidden>
      <div className="flex items-end justify-center gap-1.5 h-32">
        {IDLE_SCALES.map((scale, i) => {
          const heightPct = isSpeaking && audioLevel > 0
            ? (activeScale * (0.8 + (i / BAR_COUNT) * 0.4) * 100)
            : scale * 100;
          const delay = i * 0.08;
          return (
            <motion.span
              key={i}
              className="w-2 rounded-full bg-cyan-500 waveform-bar min-h-[10px]"
              animate={
                reducedMotion
                  ? {}
                  : isSpeaking && audioLevel > 0
                    ? {
                        height: [
                          `${heightPct}%`,
                          `${heightPct * 1.15}%`,
                          `${heightPct}%`,
                        ],
                      }
                    : {
                        height: [
                          `${IDLE_SCALES[i] * 100}%`,
                          `${IDLE_SCALES[(i + 1) % BAR_COUNT] * 100}%`,
                          `${IDLE_SCALES[i] * 100}%`,
                        ],
                      }
              }
              transition={{
                duration: isSpeaking && audioLevel > 0 ? 0.1 : 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
                delay,
              }}
              style={{ height: `${Math.max(12, Math.min(100, heightPct))}%` }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default AudioVisualizer;
