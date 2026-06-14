import React from 'react';

type ScoreSignalRingProps = {
  percent: number | null;
  strokeClass: string;
  size?: number;
};

/** Circular score ring — 32px display, 36×36 viewBox (matches design mock). */
const ScoreSignalRing: React.FC<ScoreSignalRingProps> = ({ percent, strokeClass, size = 32 }) => {
  const normalized = percent != null ? Math.min(100, Math.max(0, percent)) / 100 : 0;
  const center = 18;
  const r = 15.9155;
  const circ = 2 * Math.PI * r;
  const strokeOffset = (1 - normalized) * circ;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className="shrink-0"
      aria-hidden
    >
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-white/5"
        strokeWidth="3"
      />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke="currentColor"
        className={strokeClass}
        strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={strokeOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
};

export default ScoreSignalRing;
