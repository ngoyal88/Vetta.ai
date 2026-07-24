import React from 'react';
import {
  Clock,
  Code2,
  FileSearch,
  FileText,
  Gauge,
  Play,
  Rocket,
  Sparkles,
  Target,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { useAuth } from 'shared/context/AuthContext';
import { useInterviewHistory } from '../hooks/useInterviewHistory';
import {
  formatInterviewTitle,
  getInterviewId,
  getInterviewStartedAt,
} from '../utils/interviewHistoryUtils';
import { useVaultEntriesQuery } from 'features/vault/queries/useVaultEntriesQuery';

import {
  getModeByApiType,
  getModeRoute,
  QUICK_LAUNCH_MODES,
  supportsReplay,
} from 'features/interview/domain/modeContract';
import type { ModeSlug } from 'features/interview/domain/modeContract';

function getQuickLaunchIcon(slug: ModeSlug): React.ElementType {
  switch (slug) {
    case 'resume_deep_dive':
      return FileSearch;
    case 'pair_programming':
      return Code2;
    case 'pressure':
      return Gauge;
    default:
      return Target;
  }
}

type QuickLaunchItem = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  accent: 'primary' | 'secondary' | 'tertiary';
  href?: string;
  badge?: string;
  status?: 'active' | 'soon';
  requiresResume?: boolean;
};

const QUICK_LAUNCH_ITEMS: QuickLaunchItem[] = QUICK_LAUNCH_MODES.map((mode) => ({
  id: mode.catalogSlug,
  title: mode.title,
  description: mode.description,
  icon: getQuickLaunchIcon(mode.catalogSlug),
  accent: mode.accent,
  href: mode.status === 'active' ? mode.href : undefined,
  badge: mode.badge,
  status: mode.status,
  requiresResume: mode.requiresResume,
}));

function RadarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12l5-2" />
      <path d="M12 4v4" />
    </svg>
  );
}

function getAccentClasses(accent: QuickLaunchItem['accent']) {
  if (accent === 'secondary') return 'border-l-[var(--color-secondary)] text-[var(--color-secondary)]';
  if (accent === 'tertiary') return 'border-l-[var(--color-tertiary)] text-[var(--color-tertiary)]';
  return 'border-l-[var(--color-primary)] text-[var(--color-primary)]';
}

function formatRelativeTime(value?: string) {
  if (!value) return 'Date unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date unknown';
  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function normalizeScore(value?: number | null) {
  if (value == null) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  if (num <= 10) return Math.round(num * 10);
  return Math.round(Math.min(100, Math.max(0, num)));
}

function formatTag(value: string) {
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function ScoreRing({ score, tone }: { score?: number | null; tone: 'primary' | 'secondary' }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const safeScore = score ?? 0;
  const offset = circumference - (safeScore / 100) * circumference;
  const strokeColor = tone === 'secondary' ? 'var(--color-secondary)' : 'var(--color-primary)';

  return (
    <svg className="h-10 w-10" viewBox="0 0 48 48" aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth="4"
      />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
      />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="var(--color-on-surface)"
      >
        {score == null ? '--' : safeScore}
      </text>
    </svg>
  );
}

function MarketFitGauge({ score }: { score?: number | null }) {
  const reduceMotion = useReducedMotion();
  const [animate, setAnimate] = React.useState(false);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const safeScore = score ?? 0;
  const offset = circumference - (safeScore / 100) * circumference;

  React.useEffect(() => {
    if (reduceMotion) {
      setAnimate(true);
      return;
    }
    const id = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(id);
  }, [reduceMotion]);

  return (
    <div className="dashboard-panel dashboard-panel--glass flex flex-col items-center justify-center p-6 text-center">
      <h3 className="type-label-md w-full text-left uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        Market Fit Score
      </h3>
      <svg className="my-6" width="160" height="160" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="market-fit-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-secondary)" />
            <stop offset="100%" stopColor="var(--color-primary)" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="6"
          transform="rotate(-90 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="url(#market-fit-gradient)"
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={animate ? offset : circumference}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: reduceMotion ? 'none' : 'stroke-dashoffset 1200ms ease-out' }}
        />
        <text x="50" y="54" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--color-on-surface)">
          {score == null ? '--' : safeScore}
        </text>
        <text x="50" y="69" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-on-surface-variant)">
          {score == null ? 'Awaiting data' : 'Score'}
        </text>
      </svg>
      <p className="type-body-md text-[var(--color-on-surface-variant)]">
        {score == null
          ? 'Complete your first resume upload or interview to generate a baseline.'
          : 'Based on your latest resume and interview signals.'}
      </p>
    </div>
  );
}

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { entries, meta, loading: vaultLoading, error: vaultError } = useVaultEntriesQuery();
  const {
    items: historyItems,
    loading: historyLoading,
    error: historyError,
  } = useInterviewHistory({ limit: 4 });
  const firstName = React.useMemo(() => {
    const name = currentUser?.displayName?.trim();
    if (name) return name.split(' ')[0];
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'there';
  }, [currentUser]);

  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  const hasResumes = (meta.resume_count ?? entries.length) > 0;
  const activeEntry = React.useMemo(() => {
    if (!entries.length) return null;
    const activeId = meta.active_resume_id;
    return (
      entries.find((entry) => entry.id === activeId) ||
      entries.find((entry) => entry.is_active) ||
      entries.find((entry) => entry.current_version_id) ||
      entries[0] ||
      null
    );
  }, [entries, meta.active_resume_id]);

  const resumeScore = normalizeScore(activeEntry?.scorecard?.score ?? activeEntry?.avg_interview_score ?? null);
  const roleFitScore = normalizeScore(activeEntry?.scorecard?.role_fit_score ?? null);
  const historyScores = React.useMemo(
    () =>
      historyItems
        .map((item) => normalizeScore(item.scores?.overall ?? null))
        .filter((score): score is number => score != null),
    [historyItems],
  );
  const averageHistoryScore = historyScores.length
    ? Math.round(historyScores.reduce((sum, score) => sum + score, 0) / historyScores.length)
    : null;
  const marketFitScore = resumeScore ?? averageHistoryScore;

  const hasTargetRole = historyItems.some((item) => item.target_role || item.custom_role);
  const hasGapAnalysis = Boolean(resumeScore) || historyItems.some((item) => item.scores?.overall != null);
  const isNewUser = !vaultLoading && !historyLoading && !hasResumes && historyItems.length === 0;

  const initializationSteps = React.useMemo(() => {
    const steps = [
      {
        id: 'resume',
        title: 'Upload Master Resume',
        description: 'Provide the foundational data for your intelligence core.',
        complete: hasResumes,
        actionLabel: 'Upload Resume',
        actionHref: '/resume-vault',
      },
      {
        id: 'target-role',
        title: 'Index Target Role',
        description: 'Define your trajectory to align matching algorithms.',
        complete: hasTargetRole,
        actionLabel: 'Set Target Role',
        actionHref: '/signal-intelligence',
      },
      {
        id: 'gap-analysis',
        title: 'Run Application Fit',
        description: 'Analyze your resume against a target job before you apply.',
        complete: hasGapAnalysis,
        actionLabel: 'Analyze Fit',
        actionHref: '/application-fit',
      },
    ];

    return steps.map((step, index) => {
      const locked = index > 0 && !steps[index - 1].complete;
      return { ...step, locked, active: !step.complete && !locked };
    });
  }, [hasGapAnalysis, hasResumes, hasTargetRole]);

  const completedSteps = initializationSteps.filter((step) => step.complete).length;

  const recentActivity = React.useMemo(() => {
    return historyItems.slice(0, 2).map((item, index) => {
      const startedAt = getInterviewStartedAt(item);
      const title = formatInterviewTitle(item);
      const focus = item.interview_focus ? formatTag(String(item.interview_focus)) : null;
      const duration = typeof item.duration_minutes === 'number' ? `${item.duration_minutes} mins` : null;
      const subtitle = [focus, duration].filter(Boolean).join(' • ') || 'Interview session';
      const tags = [
        item.difficulty ? formatTag(String(item.difficulty)) : null,
        focus,
      ].filter((tag): tag is string => Boolean(tag));

      const score = normalizeScore(item.scores?.overall ?? null);
      const type = String(item.interview_type || '');
      const canReplay = supportsReplay(type);
      const mode = getModeByApiType(type);
      const actionHref =
        canReplay && mode?.catalogSlug ? getModeRoute(mode.catalogSlug) : '/ai-interview/history';
      const actionLabel = canReplay ? 'Practice Again' : 'View Details';

      return {
        id: getInterviewId(item) || `${index}`,
        title,
        subtitle,
        timestamp: formatRelativeTime(startedAt),
        tags,
        score,
        actionLabel,
        actionHref,
      };
    });
  }, [historyItems]);

  const resumeMetrics = React.useMemo(() => {
    const metrics = [
      {
        label: 'Resume Score',
        value: resumeScore,
        tone: resumeScore != null && resumeScore < 50 ? 'error' : 'primary',
      },
      {
        label: 'Role Fit',
        value: roleFitScore,
        tone: roleFitScore != null && roleFitScore < 50 ? 'error' : 'primary',
      },
    ];
    return metrics.map((metric) => ({
      ...metric,
      valueLabel: metric.value == null ? 'Awaiting analysis' : `${metric.value}%`,
    }));
  }, [resumeScore, roleFitScore]);

  const futureInsights = React.useMemo(() => {
    return [
      {
        id: 'skills',
        title: 'Skill Trends',
        subtitle: historyItems.length ? 'Monitoring new signals' : 'Awaiting practice data',
        icon: Sparkles,
      },
      {
        id: 'market',
        title: 'Market Radar',
        subtitle: hasResumes ? 'Resume signal active' : 'Awaiting resume upload',
        icon: RadarIcon,
      },
    ];
  }, [hasResumes, historyItems.length]);

  return (
    <div className="mx-auto w-full max-w-app px-[var(--space-margin-mobile)] py-8 md:px-[var(--space-margin-desktop)]">
          {vaultError || historyError ? (
            <div className="dashboard-panel mb-6 flex flex-col gap-2 p-4">
              <p className="type-label-md text-[var(--color-error)]">We could not load all dashboard data.</p>
              <p className="type-body-md text-[var(--color-on-surface-variant)]">
                {vaultError || historyError}
              </p>
            </div>
          ) : null}

          {isNewUser ? (
            <motion.section
              className="flex flex-col gap-4"
              {...fadeUp}
              transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
            >
              <div>
                <p className="type-label-sm uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  Ready to take command?
                </p>
                <h2 className="type-display-lg mt-2 text-[var(--color-on-surface)]">
                  Welcome to your Command Center.
                </h2>
                <p className="type-body-lg mt-3 max-w-2xl text-[var(--color-on-surface-variant)]">
                  Let&apos;s initialize your career intelligence. Complete the setup sequence below to activate your
                  AI-driven job discovery engine.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-gutter xl:grid-cols-12">
                <section className="dashboard-panel xl:col-span-8 p-6">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                    <div className="flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-[var(--color-primary)]" />
                      <h3 className="type-headline-md text-[var(--color-on-surface)]">Initialization Sequence</h3>
                    </div>
                    <span className="dashboard-pill">{completedSteps}/3 complete</span>
                  </div>

                  <div className="mt-6 space-y-4">
                    {initializationSteps.map((step, index) => (
                      <div
                        key={step.id}
                        className={[
                          'dashboard-step',
                          step.complete ? 'dashboard-step--complete' : '',
                          step.active ? 'dashboard-step--active' : '',
                          step.locked ? 'dashboard-step--locked' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div className="dashboard-step__index">{index + 1}</div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="type-label-md text-[var(--color-on-surface)]">{step.title}</h4>
                            {step.complete ? (
                              <span className="dashboard-step__status dashboard-step__status--complete">Complete</span>
                            ) : step.locked ? (
                              <span className="dashboard-step__status dashboard-step__status--locked">
                                Requires Step {index}
                              </span>
                            ) : null}
                          </div>
                          <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">
                            {step.description}
                          </p>
                          {!step.complete && !step.locked ? (
                            <Link to={step.actionHref} className="btn-primary mt-4 inline-flex h-9 px-4 text-sm">
                              {step.actionLabel}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="xl:col-span-4 flex flex-col gap-gutter">
                  <section className="dashboard-panel dashboard-panel--glass p-6 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--color-surface-container-high)]">
                      <FileText className="h-6 w-6 text-[var(--color-on-surface-variant)]" />
                    </div>
                    <h4 className="type-headline-md mt-4 text-[var(--color-on-surface)]">Awaiting Data</h4>
                    <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">
                      Upload a master resume to calculate your initial market fit score and establish baseline
                      metrics.
                    </p>
                  </section>

                  <section className="dashboard-panel dashboard-panel--glass p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="type-label-md uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                        Quick Actions
                      </h3>
                    </div>
                    <div className="mt-4 space-y-3">
                      <button
                        type="button"
                        onClick={() => navigate('/ai-interview/resume-deep-dive')}
                        disabled={!hasResumes}
                        className={[
                          'dashboard-action',
                          !hasResumes ? 'dashboard-action--disabled' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div>
                          <p className="type-label-md text-[var(--color-on-surface)]">Resume Deep-Dive</p>
                          <p className="type-label-sm text-[var(--color-on-surface-variant)]">
                            {hasResumes ? 'Primary action required' : 'Resume required'}
                          </p>
                        </div>
                        <FileSearch className="h-4 w-4 text-[var(--color-on-surface-variant)]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/ai-interview/role-targeted')}
                        className="dashboard-action"
                      >
                        <div>
                          <p className="type-label-md text-[var(--color-on-surface)]">Role-Targeted</p>
                          <p className="type-label-sm text-[var(--color-on-surface-variant)]">
                            Personalized mock interview
                          </p>
                        </div>
                        <Target className="h-4 w-4 text-[var(--color-on-surface-variant)]" />
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </motion.section>
          ) : (
            <>
              <motion.section
                className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
                {...fadeUp}
                transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
              >
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="badge-agent-active type-label-sm uppercase tracking-widest">
                      Agent Active
                    </span>
                  </div>
                  <h2 className="type-display-lg text-[var(--color-on-surface)]">Welcome back, {firstName}.</h2>
                  <p className="type-body-lg mt-2 max-w-2xl text-[var(--color-on-surface-variant)]">
                    {marketFitScore == null
                      ? 'Upload a resume or complete a session to unlock your market fit trends.'
                      : `Your current market fit score is ${marketFitScore}/100 based on recent signals.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/ai-interview')}
                  className="btn-primary dashboard-cta shadow-luminous"
                >
                  <Play className="h-4 w-4" />
                  Start Practice
                </button>
              </motion.section>

              <div className="mt-10 grid grid-cols-1 gap-gutter xl:grid-cols-12">
                <div className="xl:col-span-8 flex flex-col gap-gutter">
                  <section className="dashboard-panel p-6">
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                      <h3 className="type-headline-md flex items-center gap-2 text-[var(--color-on-surface)]">
                        <Rocket className="h-5 w-5 text-[var(--color-primary)]" />
                        Quick Launch
                      </h3>
                      <button type="button" className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
                        ...
                      </button>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {QUICK_LAUNCH_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isLocked = Boolean(item.requiresResume && !hasResumes);
                        const isDisabled = item.status === 'soon' || isLocked;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (item.href && !isDisabled) navigate(item.href);
                            }}
                            disabled={isDisabled}
                            className={[
                              'dashboard-panel dashboard-panel--glass relative flex h-full flex-col gap-3 p-6 text-left transition-all',
                              isDisabled
                                ? 'dashboard-panel--muted cursor-not-allowed'
                                : 'hover:border-[var(--color-primary)]/40 hover:shadow-luminous',
                              'border-l-4',
                              getAccentClasses(item.accent),
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-surface-container)]">
                                <Icon className="h-5 w-5" />
                              </div>
                              {item.badge ? (
                                <span className="dashboard-chip">{item.badge}</span>
                              ) : null}
                            </div>
                            <div>
                              <h4 className="type-headline-md text-[var(--color-on-surface)]">{item.title}</h4>
                              <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">
                                {item.description}
                              </p>
                            </div>
                            {item.status === 'soon' ? (
                              <span className="type-label-sm text-[var(--color-on-surface-variant)]">Coming soon</span>
                            ) : null}
                            {isLocked ? (
                              <span className="type-label-sm text-[var(--color-on-surface-variant)]">Resume required</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="dashboard-panel p-6">
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                      <h3 className="type-headline-md flex items-center gap-2 text-[var(--color-on-surface)]">
                        <Clock className="h-5 w-5 text-[var(--color-on-surface-variant)]" />
                        Recent Activity
                      </h3>
                      <Link
                        to="/ai-interview/history"
                        className="type-label-sm text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-container)]"
                      >
                        View All
                      </Link>
                    </div>
                    <div className="mt-6 space-y-6">
                      {historyLoading ? (
                        <p className="type-body-md text-[var(--color-on-surface-variant)]">Loading activity...</p>
                      ) : recentActivity.length === 0 ? (
                        <div className="dashboard-panel dashboard-panel--muted flex flex-col items-start gap-3 p-4">
                          <p className="type-label-md text-[var(--color-on-surface)]">No sessions yet</p>
                          <p className="type-body-md text-[var(--color-on-surface-variant)]">
                            Start a practice session to build your activity timeline.
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate('/ai-interview')}
                            className="btn-primary h-9 px-4 text-sm"
                          >
                            Start Practice
                          </button>
                        </div>
                      ) : (
                        recentActivity.map((item, index) => (
                          <div
                            key={item.id}
                            className={[
                              'flex flex-col gap-4 md:flex-row md:items-start',
                              index === recentActivity.length - 1 ? '' : 'border-b border-[var(--border-subtle)] pb-6',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <div className="flex items-center gap-4">
                              <ScoreRing score={item.score} tone={index === 0 ? 'secondary' : 'primary'} />
                              <div className="md:hidden">
                                <p className="type-label-md text-[var(--color-on-surface)]">{item.title}</p>
                                <p className="type-label-sm text-[var(--color-on-surface-variant)]">{item.timestamp}</p>
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="type-label-md text-[var(--color-on-surface)]">{item.title}</p>
                                  <p className="type-body-md text-[var(--color-on-surface-variant)]">{item.subtitle}</p>
                                </div>
                                <span className="type-label-sm text-[var(--color-on-surface-variant)]">{item.timestamp}</span>
                              </div>
                              {item.tags.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.tags.map((tag) => (
                                    <span key={tag} className="dashboard-tag">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <Link
                                to={item.actionHref}
                                className="btn-ghost mt-4 inline-flex px-4 text-sm"
                              >
                                {item.actionLabel}
                              </Link>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>

                <div className="xl:col-span-4 flex flex-col gap-gutter">
                  <section className="dashboard-panel dashboard-panel--glass p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="type-label-md uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                        Active Resume
                      </h3>
                      <Link
                        to="/resume-vault"
                        className="text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-container)]"
                      >
                        <FileText className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="mt-5 flex items-center gap-4">
                      <div className="relative flex h-14 w-12 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--color-surface-container)]">
                        <FileText className="h-6 w-6 text-[var(--color-primary)]" />
                        {hasResumes ? (
                          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-tertiary)]" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="type-label-md truncate text-[var(--color-on-surface)]">
                          {activeEntry?.name ?? 'No active resume'}
                        </p>
                        <p className="type-label-sm text-[var(--color-on-surface-variant)]">
                          {activeEntry?.current_version_id ? 'Parsed and indexed' : hasResumes ? 'Processing' : 'Upload a resume to begin'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 space-y-4">
                      {resumeMetrics.map((metric) => (
                        <div key={metric.label}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="type-label-sm text-[var(--color-on-surface-variant)]">{metric.label}</span>
                            <span
                              className={
                                metric.tone === 'error'
                                  ? 'type-label-sm text-[var(--color-error)]'
                                  : 'type-label-sm text-[var(--color-on-surface)]'
                              }
                            >
                              {metric.valueLabel}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-white/5">
                            <div
                              className={
                                metric.value == null
                                  ? 'h-1.5 rounded-full bg-white/5'
                                  : metric.tone === 'error'
                                    ? 'h-1.5 rounded-full bg-[var(--color-error)]'
                                    : 'h-1.5 rounded-full bg-[var(--color-primary)]'
                              }
                              style={{ width: `${metric.value ?? 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <Link to="/resume-vault" className="btn-ghost mt-6 inline-flex w-full justify-center text-sm">
                      Update Vault
                    </Link>
                  </section>

                  <MarketFitGauge score={marketFitScore} />

                  <section className="dashboard-panel dashboard-panel--glass p-6">
                    <h3 className="type-label-md uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                      Future Insights
                    </h3>
                    <div className="mt-5 space-y-4">
                      {futureInsights.map(({ id, title, subtitle, icon: Icon }) => (
                        <div key={id} className="flex items-center gap-3 opacity-80">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="type-label-md text-[var(--color-on-surface)]">{title}</p>
                            <p className="type-label-sm text-[var(--color-on-surface-variant)]">{subtitle}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
    </div>
  );
};

export default Dashboard;
