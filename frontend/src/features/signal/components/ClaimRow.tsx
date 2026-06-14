import React, { memo, useState } from 'react';

import type { ProfileClaim } from 'shared/services/api';

type ClaimRowProps = {
  item: ProfileClaim;
  checked: boolean;
  acting: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onAccept: (item: ProfileClaim) => void;
  onReject: (item: ProfileClaim) => void;
};

export const ClaimRow = memo(function ClaimRow({
  item,
  checked,
  acting,
  onToggle,
  onAccept,
  onReject,
}: ClaimRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded border border-[var(--border)] p-3">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(item.id, e.target.checked)}
          className="mt-1"
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">{item.claim_category}</p>
            {item.demonstration_strength ? (
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--cream-3)]">
                {item.demonstration_strength}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-[var(--cream-0)]">{item.claim_text}</p>
          {item.evidence_quote ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs text-[var(--teal-2)]"
            >
              {expanded ? 'Hide quote' : 'Show quote'}
            </button>
          ) : null}
          {expanded && item.evidence_quote ? (
            <p className="mt-1 text-xs italic text-[var(--cream-3)]">&ldquo;{item.evidence_quote}&rdquo;</p>
          ) : null}
          <p className="mt-1 text-[11px] text-[var(--cream-4)]">
            confidence: {Math.round((item.confidence || 0) * 100)}% · session:{' '}
            {item.evidence_session_id || 'n/a'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={acting}
            onClick={() => onAccept(item)}
            className="rounded border border-emerald-500/50 px-2 py-1 text-xs text-emerald-300 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => onReject(item)}
            className="rounded border border-rose-500/50 px-2 py-1 text-xs text-rose-300 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
});
