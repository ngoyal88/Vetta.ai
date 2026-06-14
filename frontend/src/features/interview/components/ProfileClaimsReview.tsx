import React from 'react';
import { Link } from 'react-router-dom';

import { useSessionProfileClaims } from '../hooks/useSessionProfileClaims';
import { ProfileClaimCard } from './ProfileClaimCard';

type ProfileClaimsReviewProps = {
  sessionId?: string;
};

function ClaimsShell({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-xl border border-[var(--border)] p-4">
      <h2 className="text-base font-semibold text-white">Verified profile claims</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}

export function ProfileClaimsReview({ sessionId }: ProfileClaimsReviewProps) {
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
      <ClaimsShell message="Analyzing what you demonstrated in this session…" />
    );
  }

  if (pipelinePending && pollExhausted) {
    return (
      <ClaimsShell
        message="Still analyzing — this can take up to 2 minutes. You can refresh or review claims later in Signal Intelligence."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={refetch}
              className="rounded-md border border-[var(--teal-2)] px-3 py-1.5 text-sm text-[var(--cream-0)]"
            >
              Refresh
            </button>
            <Link
              to="/signal-intelligence"
              className="text-sm text-[var(--teal-2)] underline-offset-2 hover:underline"
            >
              Open Signal Intelligence
            </Link>
          </div>
        }
      />
    );
  }

  if (pipelineFailed) {
    return (
      <ClaimsShell message="Claim analysis is temporarily unavailable. Your interview report is still saved." />
    );
  }

  if (pipelineSkipped) {
    return (
      <ClaimsShell message="Not enough interview evidence to generate profile claims for this session." />
    );
  }

  if (pipelineStatus === 'completed' && !strengthClaims.length && !gapClaims.length) {
    return (
      <ClaimsShell message="No verifiable claims were found for this session. Deeper answers with specifics help us capture strengths." />
    );
  }

  if (!strengthClaims.length && !gapClaims.length) {
    return (
      <ClaimsShell
        message="Claims are still being processed. Refresh in a moment or check Signal Intelligence shortly."
        action={
          <button
            type="button"
            onClick={refetch}
            className="rounded-md border border-[var(--teal-2)] px-3 py-1.5 text-sm text-[var(--cream-0)]"
          >
            Refresh
          </button>
        }
      />
    );
  }

  return (
    <section className="mt-8 space-y-6">
      {strengthClaims.length > 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-base font-semibold text-white">Add to your profile</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            These strengths were demonstrated with evidence. Accept to include in future interviews.
          </p>
          <div className="mt-3 space-y-2">
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
        <div className="rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-base font-semibold text-white">Practice these</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Topics where explanation was weak. Practice in a role-targeted mock.
          </p>
          <div className="mt-3 space-y-2">
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
    </section>
  );
}
