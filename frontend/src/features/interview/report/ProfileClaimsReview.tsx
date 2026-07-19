import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Loader2, TrendingUp } from "lucide-react";

import { useSessionProfileClaims } from "./useSessionProfileClaims";
import { ProfileClaimCard } from "./ProfileClaimCard";

type Props = {
  sessionId?: string;
};

function ClaimsMessage({
  title,
  message,
  loading,
  action,
}: {
  title: string;
  message: string;
  loading?: boolean;
  action?: ReactNode;
}) {
  return (
    <section className="sr-claims" aria-live="polite">
      <h3 className={`sr-claims__heading ${loading ? "" : "sr-claims__heading--muted"}`}>
        {loading ? <Loader2 size={22} className="sr-claims__spin" aria-hidden /> : null}
        {title}
      </h3>
      {loading ? (
        <div className="space-y-4" aria-hidden>
          <div className="sr-shimmer" />
          <div className="sr-shimmer sr-shimmer--short" />
        </div>
      ) : (
        <div className="sr-claims__empty">
          <p>{message}</p>
          {action ? <div className="sr-claims__actions">{action}</div> : null}
        </div>
      )}
    </section>
  );
}

export function ProfileClaimsReview({ sessionId }: Props) {
  const {
    strengthClaims,
    gapClaims,
    loading,
    pipelineStatus,
    pipelinePending,
    pollExhausted,
    pipelineFailed,
    pipelineSkipped,
    actingId,
    refetch,
    acceptClaim,
    rejectClaim,
  } = useSessionProfileClaims(sessionId);

  if (!sessionId) return null;

  if (loading || (pipelinePending && !pollExhausted)) {
    return (
      <ClaimsMessage
        title="Analyzing demonstrated claims..."
        message="Analyzing what you demonstrated in this session…"
        loading
      />
    );
  }

  if (pipelinePending && pollExhausted) {
    return (
      <ClaimsMessage
        title="Still analyzing claims"
        message="This can take up to 2 minutes. Refresh or review claims later in Signal Intelligence."
        action={
          <>
            <button type="button" className="sr-btn sr-btn--ghost" onClick={refetch}>
              Refresh
            </button>
            <Link to="/signal-intelligence" className="sr-btn sr-btn--link">
              Open Signal Intelligence
            </Link>
          </>
        }
      />
    );
  }

  if (pipelineFailed) {
    return (
      <ClaimsMessage
        title="Claims unavailable"
        message="Claim analysis is temporarily unavailable. Your interview report is still saved."
      />
    );
  }

  if (pipelineSkipped) {
    return (
      <ClaimsMessage
        title="No claims this session"
        message="Not enough interview evidence to generate profile claims for this session."
      />
    );
  }

  if (pipelineStatus === "completed" && !strengthClaims.length && !gapClaims.length) {
    return (
      <ClaimsMessage
        title="No verifiable claims"
        message="No verifiable claims were found for this session. Deeper answers with specifics help us capture strengths."
      />
    );
  }

  if (!strengthClaims.length && !gapClaims.length) {
    return (
      <ClaimsMessage
        title="Claims processing"
        message="Claims are still being processed. Refresh in a moment or check Signal Intelligence shortly."
        action={
          <button type="button" className="sr-btn sr-btn--ghost" onClick={refetch}>
            Refresh
          </button>
        }
      />
    );
  }

  return (
    <section className="sr-claims">
      <div className="sr-claims__grid">
        {strengthClaims.length > 0 ? (
          <div>
            <h3 className="sr-claims__col-title">
              <BadgeCheck size={22} className="sr-icon--secondary" aria-hidden />
              Add to Profile
            </h3>
            <div className="sr-claims__list">
              {strengthClaims.map((claim) => (
                <ProfileClaimCard
                  key={claim.id}
                  claim={claim}
                  acting={actingId === claim.id}
                  onAccept={acceptClaim}
                  onReject={rejectClaim}
                />
              ))}
            </div>
          </div>
        ) : null}

        {gapClaims.length > 0 ? (
          <div>
            <h3 className="sr-claims__col-title">
              <TrendingUp size={22} className="sr-icon--tertiary" aria-hidden />
              Practice These
            </h3>
            <div className="sr-claims__list">
              {gapClaims.map((claim) => (
                <ProfileClaimCard
                  key={claim.id}
                  claim={claim}
                  acting={actingId === claim.id}
                  onAccept={acceptClaim}
                  onReject={rejectClaim}
                  practiceHref={`/ai-interview/role-targeted?gap=${encodeURIComponent(claim.claim_text)}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
