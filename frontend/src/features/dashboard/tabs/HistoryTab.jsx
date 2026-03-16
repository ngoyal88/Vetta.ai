import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RefreshCw, Trash2 } from 'lucide-react';

function ScoreDonut({ score, size = 32 }) {
  const normalized = score != null ? Math.min(10, Math.max(0, score)) / 10 : 0;
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const stroke = (1 - normalized) * circ;
  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function RecommendationBadge({ score }) {
  if (score == null) return null;
  const s = Number(score);
  if (s >= 8) return <span className="text-xs font-medium text-emerald-400">Hire</span>;
  if (s >= 6) return <span className="text-xs font-medium text-amber-400">Maybe</span>;
  return <span className="text-xs font-medium text-red-400">Needs Work</span>;
}

export default function HistoryTab({
  loadingInterviews,
  previousInterviews,
  expandedInterviewId,
  deletingInterviewId,
  fetchHistory,
  handleToggleDetails,
  handleDeleteInterview,
  formatDate,
  setActiveTab,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-raised border border-[var(--border-subtle)] p-6 md:p-8"
    >
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-cyan-500" />
          <h2 className="text-xl font-semibold text-white">Previous interviews</h2>
        </div>
        <button
          type="button"
          onClick={fetchHistory}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loadingInterviews ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent mb-4" />
          <p className="text-zinc-500 text-sm">Loading...</p>
        </div>
      ) : previousInterviews.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 mb-4">No previous interviews yet</p>
          <button type="button" onClick={() => setActiveTab('start')} className="btn-outline-cyan h-10 text-sm">
            Start your first interview
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline: left border */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[var(--border-subtle)]" aria-hidden />
          <ul className="space-y-0">
            {previousInterviews.map((interview, index) => {
              const startedAt = interview.started_at || interview.created_at || interview.completed_at;
              const overall = interview?.scores?.overall;
              const title = interview.custom_role
                ? `${String(interview.interview_type || 'custom').toUpperCase()} — ${interview.custom_role}`
                : String(interview.interview_type || 'interview').toUpperCase();
              const rawFeedback = interview?.feedback ?? interview?.final_feedback;
              const feedbackText =
                typeof rawFeedback === 'string'
                  ? rawFeedback
                  : rawFeedback && typeof rawFeedback === 'object'
                    ? String(rawFeedback.feedback || rawFeedback.text || '')
                    : '';
              const feedbackGeneratedAt =
                rawFeedback && typeof rawFeedback === 'object'
                  ? rawFeedback.generated_at || rawFeedback.generatedAt
                  : null;
              const isExpanded = expandedInterviewId === interview.id;

              return (
                <li key={interview.id} className="relative flex gap-4 pl-12 pb-6">
                  <div className="absolute left-0 top-1.5 w-10 h-10 rounded-full bg-raised border border-[var(--border-subtle)] flex items-center justify-center z-10">
                    <ScoreDonut score={overall} size={28} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          {title}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-zinc-400">{formatDate(startedAt)}</span>
                          {interview.difficulty && (
                            <span className="text-xs text-zinc-600">· {interview.difficulty}</span>
                          )}
                          <RecommendationBadge score={overall} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleDetails(interview.id)}
                          className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-zinc-400 hover:text-white text-xs font-medium transition-colors"
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInterview(interview.id)}
                          disabled={deletingInterviewId === interview.id}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-3">
                            {interview.candidate_name && (
                              <p className="text-sm text-zinc-400">
                                <span className="text-zinc-500">Candidate:</span> {interview.candidate_name}
                              </p>
                            )}
                            {feedbackText && (
                              <div className="p-4 rounded-xl bg-overlay border border-[var(--border-subtle)]">
                                <p className="text-xs text-zinc-500 mb-2">
                                  {feedbackGeneratedAt ? `Generated ${formatDate(feedbackGeneratedAt)}` : 'Feedback'}
                                </p>
                                <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">
                                  {feedbackText}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
