import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, BarChart3, ChevronRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  AI_INTERVIEW_HISTORY_PATH,
  AI_INTERVIEW_HUB_PATH,
} from 'features/interview/domain/modeContract';
import { fadeUpWithDelay, getHeaderMotion } from 'features/modes/shared/utils/motion';

import { useInterviewHistory } from '../hooks/useInterviewHistory';
import { computeSummary } from '../utils/interviewAnalytics';
import PageLoadingState from 'shared/components/PageLoadingState';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <p className="type-label-sm uppercase tracking-[0.18em] text-[var(--color-on-surface-variant)]">
        {label}
      </p>
      <p className="type-headline-lg mt-2 text-[var(--color-on-surface)]">{value}</p>
    </div>
  );
}

function BreakdownBars({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;

  if (!entries.length) {
    return (
      <div className="glass-panel rounded-xl p-5">
        <p className="type-label-sm uppercase tracking-[0.18em] text-[var(--color-on-surface-variant)]">
          {title}
        </p>
        <p className="type-body-md mt-3 text-[var(--color-on-surface-variant)]">No data yet</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-5">
      <p className="type-label-sm uppercase tracking-[0.18em] text-[var(--color-on-surface-variant)]">
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {entries.map(([key, count]) => (
          <div key={key}>
            <div className="mb-1 flex justify-between text-xs text-[var(--color-on-surface-variant)]">
              <span className="truncate pr-2 capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="font-semibold text-[var(--color-on-surface)]">{count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-surface-bright)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)]"
                style={{ width: `${Math.max(8, (count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const AnalyticsPage: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const { items, loading, refresh } = useInterviewHistory({ limit: 50 });
  const summary = useMemo(() => computeSummary(items), [items]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden pb-16 pt-10">
      <div
        className="pointer-events-none absolute -top-20 right-1/4 h-[360px] w-[360px] rounded-full bg-[var(--color-secondary)]/10 blur-[120px]"
        aria-hidden
      />

      <div className="app-container relative z-10">
        <Link
          to={AI_INTERVIEW_HUB_PATH}
          className="mb-6 inline-flex w-fit items-center gap-2 text-sm font-medium text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-on-surface)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to training modes
        </Link>

        <motion.header
          {...getHeaderMotion(reduceMotion)}
          className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <p className="type-label-sm uppercase tracking-[0.24em] text-[var(--color-secondary)]">
              AI Interview
            </p>
            <div className="mt-2 flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-[var(--color-primary)]" aria-hidden />
              <h1 className="type-headline-lg text-[var(--color-on-surface)]">Your progress</h1>
            </div>
            <p className="type-body-md mt-2 max-w-2xl text-[var(--color-on-surface-variant)]">
              Track scores, session volume, and practice patterns across your interview training.
            </p>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="glass-panel inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] px-5 py-3 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-container)] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 text-[var(--color-secondary)] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </motion.header>

        {loading ? (
          <PageLoadingState variant="metrics" minHeightClassName="py-6" />
        ) : summary.totalSessions === 0 ? (
          <div className="glass-panel rounded-xl py-20 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <BarChart3 className="h-6 w-6" aria-hidden />
            </div>
            <p className="type-body-lg text-[var(--color-on-surface-variant)]">
              Complete a session to see trends here
            </p>
            <Link
              to={AI_INTERVIEW_HUB_PATH}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary-container)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary-container)] shadow-[var(--shadow-luminous)] transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)]"
            >
              Start practicing
            </Link>
          </div>
        ) : (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUpWithDelay(0.06)}
            className="space-y-6"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="Total sessions" value={String(summary.totalSessions)} />
              <SummaryCard
                label="Avg score"
                value={summary.avgOverallScore != null ? `${summary.avgOverallScore}/10` : '—'}
              />
              <SummaryCard label="Last 30 days" value={String(summary.sessionsLast30Days)} />
              <SummaryCard
                label="Pass rate"
                value={summary.passRate != null ? `${summary.passRate}%` : '—'}
              />
            </div>

            <div className="glass-panel rounded-xl p-5">
              <p className="type-label-sm uppercase tracking-[0.18em] text-[var(--color-on-surface-variant)]">
                Score trend (recent)
              </p>
              {summary.scoreTrend.length === 0 ? (
                <p className="type-body-md mt-3 text-[var(--color-on-surface-variant)]">
                  No scored sessions yet
                </p>
              ) : (
                <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-2">
                  {summary.scoreTrend.map((point) => (
                    <div key={point.date} className="flex min-w-[48px] flex-col items-center gap-2">
                      <div className="flex h-24 w-8 items-end rounded-sm bg-[var(--color-surface-bright)]">
                        <div
                          className="w-full rounded-sm bg-[var(--color-primary)]"
                          style={{ height: `${Math.max(8, (point.score / 10) * 100)}%` }}
                          title={`${point.label}: ${point.score}/10`}
                        />
                      </div>
                      <span className="type-label-sm text-[var(--color-on-surface-variant)]">
                        {point.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <BreakdownBars title="By interview type" data={summary.byInterviewType} />
              <BreakdownBars title="By difficulty" data={summary.byDifficulty} />
            </div>

            {summary.topRoles.length > 0 ? (
              <div className="glass-panel rounded-xl p-5">
                <p className="type-label-sm uppercase tracking-[0.18em] text-[var(--color-on-surface-variant)]">
                  Top practice roles
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.topRoles.map(({ role, count }) => (
                    <span
                      key={role}
                      className="rounded-lg border border-[var(--border-strong)] bg-[var(--color-surface-container)] px-3 py-1.5 text-xs font-medium text-[var(--color-on-surface)]"
                    >
                      {role} · {count}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <Link
              to={AI_INTERVIEW_HISTORY_PATH}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:text-[var(--color-on-surface)]"
            >
              View session details
              <ChevronRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
