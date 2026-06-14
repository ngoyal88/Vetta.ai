import React from 'react';

import type { ReadinessResponse, ReadinessSnapshot } from 'shared/services/api';

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-300';
  if (score >= 55) return 'text-amber-300';
  return 'text-rose-300';
}

type ReadinessPanelProps = {
  targetRole: string;
  jobDescription: string;
  readiness: ReadinessResponse | null;
  readinessHistory: ReadinessSnapshot[];
  loading: boolean;
  onTargetRoleChange: (value: string) => void;
  onJobDescriptionChange: (value: string) => void;
  onCompute: () => void;
};

export function ReadinessPanel({
  targetRole,
  jobDescription,
  readiness,
  readinessHistory,
  loading,
  onTargetRoleChange,
  onJobDescriptionChange,
  onCompute,
}: ReadinessPanelProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <h2 className="text-lg font-semibold text-[var(--cream-0)]">Readiness Score v1</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input
          value={targetRole}
          onChange={(e) => onTargetRoleChange(e.target.value)}
          placeholder="Target role (required)"
          className="h-10 rounded-md border border-[var(--border)] bg-[var(--bg-0)] px-3 text-sm text-[var(--cream-1)]"
        />
        <button
          type="button"
          onClick={onCompute}
          disabled={loading}
          className="rounded-md border border-[var(--teal-2)] px-3 text-sm text-[var(--cream-0)] disabled:opacity-50"
        >
          {loading ? 'Computing...' : 'Compute readiness'}
        </button>
      </div>
      <textarea
        value={jobDescription}
        onChange={(e) => onJobDescriptionChange(e.target.value)}
        placeholder="Optional JD for tighter scoring"
        className="mt-3 min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--cream-1)]"
      />

      {readiness ? (
        <div className="mt-4 space-y-3">
          <p className={`text-2xl font-semibold ${scoreColor(readiness.overall_score)}`}>
            {readiness.overall_score}/100
          </p>
          <p className="text-sm text-[var(--cream-2)]">{readiness.why_this_score}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {Object.entries(readiness.breakdown).map(([key, value]) => (
              <div key={key} className="rounded border border-[var(--border)] p-2">
                <div className="mb-1 flex justify-between text-xs text-[var(--cream-3)]">
                  <span>{key}</span>
                  <span>{value}</span>
                </div>
                <div className="h-1.5 rounded bg-[var(--bg-3)]">
                  <div className="h-full rounded bg-[var(--teal-2)]" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">Top gaps</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-[var(--cream-2)]">
                {readiness.top_gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">Next actions</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-[var(--cream-2)]">
                {readiness.next_actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded border border-[var(--border)] p-2">
            <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">Readiness trend</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {readinessHistory.length === 0 ? (
                <p className="text-sm text-[var(--cream-3)]">No history yet</p>
              ) : (
                readinessHistory.map((point) => (
                  <div
                    key={point.id}
                    className="min-w-[76px] rounded border border-[var(--border)] p-2 text-center"
                  >
                    <p className="text-sm text-[var(--cream-1)]">{point.overall_score}</p>
                    <p
                      className={`text-xs ${point.delta_vs_prev >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                    >
                      {point.delta_vs_prev >= 0 ? '+' : ''}
                      {point.delta_vs_prev}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
