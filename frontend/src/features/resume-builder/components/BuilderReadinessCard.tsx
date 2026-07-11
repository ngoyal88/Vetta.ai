import type { BuilderReadinessIssue, BuilderReadinessResult, BuilderReadinessStrength } from '../utils/builderReadiness';

type BuilderReadinessCardProps = {
  readiness: BuilderReadinessResult;
  embedded?: boolean;
};

function IssueGroup({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: BuilderReadinessIssue[];
  tone: 'blocking' | 'warning' | 'info';
}) {
  if (issues.length === 0) return null;

  return (
    <section className={['rb-readiness-group', `rb-readiness-group--${tone}`].join(' ')}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface)]">{title}</h3>
        <span className="type-label-sm text-[var(--color-on-surface-variant)]">{issues.length}</span>
      </div>
      <ul className="mt-2 space-y-2 text-sm text-[var(--color-on-surface-variant)]">
        {issues.map((issue) => (
          <li key={issue.id}>
            <p className="font-medium text-[var(--color-on-surface)]">{issue.title}</p>
            <p className="mt-0.5">{issue.message}</p>
            {issue.fixHint ? <p className="mt-1 text-xs">{issue.fixHint}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StrengthGroup({ strengths }: { strengths: BuilderReadinessStrength[] }) {
  if (strengths.length === 0) return null;

  return (
    <section className="rb-readiness-group rb-readiness-group--strength">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface)]">What&apos;s working</h3>
        <span className="type-label-sm text-[var(--color-on-surface-variant)]">{strengths.length}</span>
      </div>
      <ul className="mt-2 space-y-2 text-sm text-[var(--color-on-surface-variant)]">
        {strengths.map((strength) => (
          <li key={strength.id}>
            <p className="font-medium text-[var(--color-on-surface)]">{strength.title}</p>
            <p className="mt-0.5">{strength.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function readinessHeadline(readiness: BuilderReadinessResult): string {
  if (readiness.status === 'blocked') return "You're on the right track. Fix the blocking issues below before you publish.";
  if (readiness.status === 'needs_review') return 'Strong foundation so far. A few items are still worth reviewing.';
  if (readiness.strengths.length > 0) return 'Ready to publish with a solid set of strengths already in place.';
  return 'No obvious builder issues detected right now.';
}

export default function BuilderReadinessCard({ readiness, embedded = false }: BuilderReadinessCardProps) {
  const totalIssues = readiness.blocking.length + readiness.warnings.length + readiness.info.length;

  return (
    <section className={embedded ? 'rb-readiness-panel' : 'rb-readiness-card'}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {embedded ? null : (
            <h2 className="type-label-sm uppercase tracking-[0.14em] text-[var(--color-on-surface)]">Builder readiness</h2>
          )}
          <p className={embedded ? 'text-sm text-[var(--color-on-surface-variant)]' : 'mt-1 text-sm text-[var(--color-on-surface-variant)]'}>
            {readinessHeadline(readiness)}
          </p>
        </div>
        <span className="rb-readiness-badge">
          {readiness.status === 'blocked'
            ? 'Blocked'
            : readiness.status === 'needs_review'
              ? 'Needs review'
              : 'Ready'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-on-surface-variant)]">
        <span className="rb-readiness-chip">{readiness.strengths.length} strengths</span>
        <span className="rb-readiness-chip">{readiness.blocking.length} blocking</span>
        <span className="rb-readiness-chip">{readiness.warnings.length} warnings</span>
        <span className="rb-readiness-chip">{readiness.info.length} info</span>
      </div>

      {totalIssues === 0 && readiness.strengths.length === 0 ? null : (
        <div className="mt-4 space-y-3">
          <StrengthGroup strengths={readiness.strengths} />
          <IssueGroup title="Blocking" issues={readiness.blocking} tone="blocking" />
          <IssueGroup title="Warnings" issues={readiness.warnings} tone="warning" />
          <IssueGroup title="Info" issues={readiness.info} tone="info" />
        </div>
      )}
    </section>
  );
}
