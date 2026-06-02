import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  api,
  type EnrichmentItem,
  type EnrichmentStatus,
  type ReadinessResponse,
  type ReadinessSnapshot,
} from "shared/services/api";

const STATUS_FILTERS: EnrichmentStatus[] = ["pending", "accepted", "rejected"];

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-300";
  if (score >= 55) return "text-amber-300";
  return "text-rose-300";
}

const SignalIntelligencePage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<EnrichmentStatus>("pending");
  const [enrichments, setEnrichments] = useState<EnrichmentItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [memory, setMemory] = useState<{ summary: any; timeline: EnrichmentItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessHistory, setReadinessHistory] = useState<ReadinessSnapshot[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const refreshEnrichments = async (status: EnrichmentStatus) => {
    const [enrichmentRes, memoryRes] = await Promise.all([
      api.getEnrichments(status, 100),
      api.getProfileMemory(120),
    ]);
    setEnrichments(enrichmentRes.items || []);
    setMemory(memoryRes);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await refreshEnrichments(statusFilter);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const onSingleAction = async (item: EnrichmentItem, action: "accept" | "reject") => {
    try {
      setActingId(item.id);
      if (action === "accept") await api.acceptEnrichment(item.id);
      else await api.rejectEnrichment(item.id);
      setEnrichments((prev) => prev.filter((entry) => entry.id !== item.id));
      setSelected((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      toast.success(`Enrichment ${action}ed`);
      const profileMemory = await api.getProfileMemory(120);
      setMemory(profileMemory);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActingId(null);
    }
  };

  const onBulkAction = async (action: "accepted" | "rejected") => {
    if (!selectedIds.length) return;
    try {
      setBulkBusy(true);
      await api.bulkUpdateEnrichments(
        selectedIds.map((id) => ({ enrichment_id: id, status: action })),
      );
      toast.success("Bulk update complete");
      setSelected({});
      await refreshEnrichments(statusFilter);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const onComputeReadiness = async () => {
    if (!targetRole.trim()) {
      toast.error("Target role is required");
      return;
    }
    try {
      setReadinessLoading(true);
      const score = await api.computeReadiness({
        target_role: targetRole.trim(),
        job_description: jobDescription.trim(),
      });
      setReadiness(score);
      const history = await api.getReadinessHistory(targetRole.trim(), jobDescription.trim(), 20);
      setReadinessHistory(history.history || []);
      toast.success("Readiness updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Readiness compute failed");
    } finally {
      setReadinessLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base px-5 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
          Signal Intelligence
        </p>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <h2 className="text-lg font-semibold text-[var(--cream-0)]">Readiness Score v1</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Target role (required)"
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--bg-0)] px-3 text-sm text-[var(--cream-1)]"
            />
            <button
              type="button"
              onClick={onComputeReadiness}
              disabled={readinessLoading}
              className="rounded-md border border-[var(--teal-2)] px-3 text-sm text-[var(--cream-0)] disabled:opacity-50"
            >
              {readinessLoading ? "Computing..." : "Compute readiness"}
            </button>
          </div>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
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
                    {readiness.top_gaps.map((gap) => <li key={gap}>{gap}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">Next actions</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-[var(--cream-2)]">
                    {readiness.next_actions.map((a) => <li key={a}>{a}</li>)}
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
                      <div key={point.id} className="min-w-[76px] rounded border border-[var(--border)] p-2 text-center">
                        <p className="text-sm text-[var(--cream-1)]">{point.overall_score}</p>
                        <p className={`text-xs ${point.delta_vs_prev >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          {point.delta_vs_prev >= 0 ? "+" : ""}{point.delta_vs_prev}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--cream-0)]">Enrichment Inbox</h2>
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  statusFilter === status ? "border-[var(--teal-2)] text-[var(--cream-0)]" : "border-[var(--border)] text-[var(--cream-3)]"
                }`}
              >
                {status}
              </button>
            ))}
            <button
              type="button"
              disabled={!selectedIds.length || bulkBusy}
              onClick={() => onBulkAction("accepted")}
              className="ml-auto rounded border border-[var(--teal-2)] px-3 py-1 text-xs text-[var(--cream-0)] disabled:opacity-50"
            >
              Accept selected
            </button>
            <button
              type="button"
              disabled={!selectedIds.length || bulkBusy}
              onClick={() => onBulkAction("rejected")}
              className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--cream-1)] disabled:opacity-50"
            >
              Reject selected
            </button>
          </div>

          {loading ? <p className="text-sm text-[var(--cream-3)]">Loading...</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {!loading && !error && enrichments.length === 0 ? (
            <p className="text-sm text-[var(--cream-3)]">No items in this filter.</p>
          ) : null}

          <div className="space-y-2">
            {enrichments.map((item) => (
              <div key={item.id} className="rounded border border-[var(--border)] p-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[item.id])}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">{item.type}</p>
                    <p className="text-sm text-[var(--cream-0)]">{item.value}</p>
                    {item.evidence ? <p className="mt-1 text-xs text-[var(--cream-3)]">{item.evidence}</p> : null}
                    <p className="mt-1 text-[11px] text-[var(--cream-4)]">
                      confidence: {Math.round((item.confidence || 0) * 100)}% · source: {item.source_session_id || "n/a"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={actingId === item.id}
                      onClick={() => onSingleAction(item, "accept")}
                      className="rounded border border-emerald-500/50 px-2 py-1 text-xs text-emerald-300 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={actingId === item.id}
                      onClick={() => onSingleAction(item, "reject")}
                      className="rounded border border-rose-500/50 px-2 py-1 text-xs text-rose-300 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <h2 className="text-lg font-semibold text-[var(--cream-0)]">Profile Memory</h2>
          {!memory ? (
            <p className="text-sm text-[var(--cream-3)]">Loading profile memory...</p>
          ) : (
            <>
              <p className="mt-2 text-xs text-[var(--cream-4)]">
                last refresh: {memory.summary?.last_refresh || "n/a"}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {["projects", "skills", "soft_signals"].map((kind) => (
                  <div key={kind} className="rounded border border-[var(--border)] p-2">
                    <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">{kind.replace("_", " ")}</p>
                    <ul className="mt-1 space-y-1 text-sm text-[var(--cream-2)]">
                      {(memory.summary?.[kind] || []).slice(0, 6).map((entry: any) => (
                        <li key={`${entry.value}-${entry.updated_at}`}>{entry.value}</li>
                      ))}
                      {(memory.summary?.[kind] || []).length === 0 ? <li className="text-[var(--cream-4)]">None</li> : null}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded border border-[var(--border)] p-2">
                <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">Timeline</p>
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {(memory.timeline || []).map((entry) => (
                    <div key={entry.id} className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--cream-2)]">
                      <span className="mr-2 text-[var(--cream-4)]">{entry.status}</span>
                      <span className="mr-2">{entry.type}</span>
                      <span>{entry.value}</span>
                    </div>
                  ))}
                  {(memory.timeline || []).length === 0 ? (
                    <p className="text-sm text-[var(--cream-3)]">No timeline entries yet</p>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default SignalIntelligencePage;
