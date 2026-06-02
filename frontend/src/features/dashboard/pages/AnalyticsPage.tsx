import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, ChevronRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useInterviewHistory } from '../hooks/useInterviewHistory';
import { computeSummary } from '../utils/interviewAnalytics';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--cream-4)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--cream-0)]">{value}</p>
    </div>
  );
}

function BreakdownBars({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;

  if (!entries.length) {
    return (
      <div className="rounded-sm border border-[var(--border)] bg-[var(--bg-1)] p-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--cream-4)]">{title}</p>
        <p className="text-sm text-[var(--cream-4)]">No data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-[var(--cream-4)]">{title}</p>
      <div className="space-y-3">
        {entries.map(([key, count]) => (
          <div key={key}>
            <div className="mb-1 flex justify-between text-xs text-[var(--cream-3)]">
              <span className="truncate pr-2">{key.replace(/_/g, ' ')}</span>
              <span>{count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-3)]">
              <div
                className="h-full rounded-full bg-[var(--teal-2)]"
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
  const { items, loading, refresh } = useInterviewHistory({ limit: 50 });
  const summary = useMemo(() => computeSummary(items), [items]);

  return (
    <div className="min-h-screen bg-base px-5 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
            Analytics
          </p>
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-[var(--teal-1)]" />
            <h1 className="text-xl font-semibold text-[var(--cream-0)]">Your progress</h1>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--teal-1)] border-t-transparent" />
              <p className="text-sm text-zinc-500">Loading analytics...</p>
            </div>
          ) : summary.totalSessions === 0 ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-raised p-8 text-center">
              <p className="mb-4 text-zinc-500">Complete a session to see trends here</p>
              <Link to="/ai-interview" className="btn-outline-cyan inline-flex h-10 items-center px-4 text-sm">
                Start practicing
              </Link>
            </div>
          ) : (
            <>
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

              <div className="rounded-sm border border-[var(--border)] bg-[var(--bg-1)] p-4">
                <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-[var(--cream-4)]">
                  Score trend (recent)
                </p>
                {summary.scoreTrend.length === 0 ? (
                  <p className="text-sm text-[var(--cream-4)]">No scored sessions yet</p>
                ) : (
                  <div className="flex items-end gap-2 overflow-x-auto pb-2">
                    {summary.scoreTrend.map((point) => (
                      <div key={point.date} className="flex min-w-[48px] flex-col items-center gap-2">
                        <div className="flex h-24 w-8 items-end rounded-sm bg-[var(--bg-3)]">
                          <div
                            className="w-full rounded-sm bg-[var(--teal-2)]"
                            style={{ height: `${Math.max(8, (point.score / 10) * 100)}%` }}
                            title={`${point.label}: ${point.score}/10`}
                          />
                        </div>
                        <span className="font-mono text-[9px] text-[var(--cream-4)]">{point.label}</span>
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
                <div className="rounded-sm border border-[var(--border)] bg-[var(--bg-1)] p-4">
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[var(--cream-4)]">
                    Top practice roles
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {summary.topRoles.map(({ role, count }) => (
                      <span
                        key={role}
                        className="rounded-sm border border-[var(--border)] px-2 py-1 text-xs text-[var(--cream-2)]"
                      >
                        {role} · {count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <Link
                to="/ai-interview/history"
                className="inline-flex items-center gap-1 text-sm text-[var(--teal-1)] hover:text-[var(--cream-0)]"
              >
                View session details
                <ChevronRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
