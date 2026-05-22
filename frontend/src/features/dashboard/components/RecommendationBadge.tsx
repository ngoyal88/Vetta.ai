import React from 'react';

type RecommendationBadgeProps = {
  score?: number | null;
};

const RecommendationBadge: React.FC<RecommendationBadgeProps> = ({ score }) => {
  if (score == null) return null;
  const s = Number(score);
  if (s >= 8) return <span className="text-xs font-medium text-emerald-400">Hire</span>;
  if (s >= 6) return <span className="text-xs font-medium text-amber-400">Maybe</span>;
  return <span className="text-xs font-medium text-red-400">Needs Work</span>;
};

export default RecommendationBadge;
