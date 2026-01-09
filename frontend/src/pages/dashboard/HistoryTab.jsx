import React from 'react';
import { motion } from 'framer-motion';
import { Clock, RefreshCw, Trash2 } from 'lucide-react';

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 border border-cyan-600/20 rounded-2xl p-8"
    >
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-cyan-400" />
          <h2 className="text-2xl font-bold text-white">Previous Interviews</h2>
        </div>
        <button
          onClick={fetchHistory}
          className="flex items-center gap-2 px-4 py-2 border border-cyan-500/40 text-cyan-300 rounded-lg hover:bg-cyan-500/10"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loadingInterviews ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading interviews...</p>
        </div>
      ) : previousInterviews.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-gray-400 text-lg mb-4">No previous interviews yet</p>
          <button onClick={() => setActiveTab('start')} className="btn-outline-cyan">
            Start Your First Interview
          </button>
        </div>
      ) : (
        <div className="space-y-4">
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

            return (
              <motion.div
                key={interview.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.4) }}
                className="p-5 bg-black/40 border border-cyan-600/20 rounded-xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-white font-semibold">{title}</div>
                    <div className="text-gray-400 text-sm mt-1">
                      {formatDate(startedAt)}
                      {interview.difficulty ? ` • ${interview.difficulty}` : ''}
                      {interview.status ? ` • ${interview.status}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {typeof overall === 'number' && (
                      <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-sm">
                        Score {overall.toFixed(1)}/10
                      </div>
                    )}

                    <button
                      onClick={() => handleToggleDetails(interview.id)}
                      className="px-3 py-2 border border-cyan-500/40 text-cyan-300 rounded-lg hover:bg-cyan-500/10"
                    >
                      {expandedInterviewId === interview.id ? 'Hide' : 'Details'}
                    </button>

                    <button
                      onClick={() => handleDeleteInterview(interview.id)}
                      disabled={deletingInterviewId === interview.id}
                      className="px-3 py-2 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg hover:bg-red-600/30 disabled:opacity-60"
                      title="Delete interview"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedInterviewId === interview.id && (
                  <div className="mt-4 space-y-3">
                    {interview.candidate_name && (
                      <div className="text-sm text-gray-300">
                        <span className="text-gray-500">Candidate:</span> {interview.candidate_name}
                      </div>
                    )}

                    {feedbackText && (
                      <div className="p-3 bg-black/40 border border-cyan-600/20 rounded-lg">
                        <div className="font-semibold text-cyan-300 mb-2">Feedback</div>
                        {feedbackGeneratedAt && (
                          <div className="text-xs text-gray-500 mb-2">Generated: {formatDate(feedbackGeneratedAt)}</div>
                        )}
                        <div className="text-sm text-gray-300 whitespace-pre-line">
                          {feedbackText}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
