import { memo, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";

import type { ProfileClaim } from "shared/services/api";

type Props = {
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
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isGap = claim.claim_category === "gap";

  return (
    <article className="sr-claim">
      <div className="sr-claim__top">
        <div>
          <p className="sr-claim__meta">
            {claim.claim_category}
            {claim.demonstration_strength ? ` · ${claim.demonstration_strength}` : ""}
          </p>
          <p className="sr-claim__text">{claim.claim_text}</p>
        </div>
        <div className="sr-claim__actions">
          <button
            type="button"
            className="sr-btn sr-btn--icon"
            title="Dismiss"
            aria-label="Dismiss claim"
            disabled={acting}
            onClick={() => onReject(claim)}
          >
            <X size={16} aria-hidden />
          </button>
          {!isGap ? (
            <button
              type="button"
              className="sr-btn sr-btn--primary"
              disabled={acting}
              onClick={() => onAccept(claim)}
            >
              Add
            </button>
          ) : practiceHref ? (
            <a href={practiceHref} className="sr-btn sr-btn--ghost">
              Practice
            </a>
          ) : null}
        </div>
      </div>

      {claim.evidence_quote ? (
        <div className="sr-claim__evidence">
          <button
            type="button"
            className="sr-claim__evidence-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            {expanded ? "Hide Evidence" : "Show Evidence"}
          </button>
          {expanded ? (
            <p className="sr-claim__quote">&ldquo;{claim.evidence_quote}&rdquo;</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
});
