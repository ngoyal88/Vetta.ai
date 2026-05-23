import React from 'react';

type ScoreDonutProps = {
  score?: number | null;
  size?: number;
};

const ScoreDonut: React.FC<ScoreDonutProps> = ({ score, size = 32 }) => {
  const normalized = score != null ? Math.min(10, Math.max(0, score)) / 10 : 0;
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const stroke = (1 - normalized) * circ;

  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
};

export default ScoreDonut;
