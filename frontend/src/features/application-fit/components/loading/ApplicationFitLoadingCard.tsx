import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';

const LOADING_STAGES = [
  'Reading the job description and role targets.',
  'Matching your resume to visible requirements.',
  'Estimating ATS, recruiter, and hiring-manager risk.',
];

export function ApplicationFitLoadingCard() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % LOADING_STAGES.length);
    }, 1600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center rounded-2xl p-8 text-center glass-panel">
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--color-surface-container-highest)] bg-[var(--color-surface)]">
          <BarChart3 className="h-8 w-8 text-[var(--color-primary)]" aria-hidden />
        </div>
        <div
          className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--color-primary)]"
          aria-hidden
        />
      </div>
      <h2 className="type-headline-md mb-2 text-[var(--color-on-surface)]">Analyzing…</h2>
      <p className="type-body-md text-[var(--color-on-surface-variant)]">
        {LOADING_STAGES[stageIndex]}
      </p>
    </div>
  );
}
