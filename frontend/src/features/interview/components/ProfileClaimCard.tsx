import React, { memo, useState } from 'react';

import type { ProfileClaim } from 'shared/services/api';

type ProfileClaimCardProps = {
  claim: ProfileClaim;
  acting: boolean;
  onAccept: (claim: ProfileClaim) => void;
  onReject: (claim: ProfileClaim) => void;
  practiceHref?: string;
};

export const ProfileClaimCard = memo(function ProfileClaimCard({
  claim,
  acting,
  onAccept,
  onReject,
  practiceHref,
}: ProfileClaimCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isGap = claim.claim_category === 'gap';

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            {claim.claim_category}
            {claim.demonstration_strength ? ` · ${claim.demonstration_strength}` : ''}
          </p>
          <p className="mt-1 text-sm text-[var(--cream-0)]">{claim.claim_text}</p>
          {claim.evidence_quote ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs text-[var(--teal-2)]"
            >
              {expanded ? 'Hide evidence' : 'Show evidence'}
            </button>
          ) : null}
          {expanded && claim.evidence_quote ? (
            <p className="mt-1 text-xs italic text-[var(--cream-3)]">&ldquo;{claim.evidence_quote}&rdquo;</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {!isGap ? (
            <button
              type="button"
              disabled={acting}
              onClick={() => onAccept(claim)}
              className="rounded border border-emerald-500/50 px-2 py-1 text-xs text-emerald-300 disabled:opacity-50"
            >
              Add to profile
            </button>
          ) : practiceHref ? (
            <a
              href={practiceHref}
              className="rounded border border-[var(--teal-2)] px-2 py-1 text-center text-xs text-[var(--cream-0)]"
            >
              Practice
            </a>
          ) : null}
          <button
            type="button"
            disabled={acting}
            onClick={() => onReject(claim)}
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--cream-2)] disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
});
