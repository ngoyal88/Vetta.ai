import React from 'react';

import {
  getVaultScoreLabel,
  getVaultScoreRingClass,
  getVaultScoreTextClass,
  getVaultScoreTier,
  type VaultScoreTier,
} from 'features/vault/utils/scorePresentation';

type VaultScoreRingProps = {
  score: number | null;
  tier?: VaultScoreTier;
};

const RING_PATH =
  'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';

export default function VaultScoreRing({ score, tier: tierOverride }: VaultScoreRingProps) {
  const tier = tierOverride ?? getVaultScoreTier(score);
  const ringClass = getVaultScoreRingClass(tier);
  const labelClass = getVaultScoreTextClass(tier);
  const dashOffset = score == null ? 0 : score;

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-8 w-8 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
          <path
            d={RING_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-[color-mix(in_srgb,var(--color-on-surface)_8%,transparent)]"
          />
          {score != null ? (
            <path
              d={RING_PATH}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${dashOffset}, 100`}
              className={ringClass}
            />
          ) : null}
        </svg>
        <span className="text-[10px] font-bold text-[var(--color-on-surface)]">{score ?? '—'}</span>
      </div>
      {score != null ? (
        <span className={`type-label-sm ${labelClass}`}>{getVaultScoreLabel(tier)}</span>
      ) : null}
    </div>
  );
}
