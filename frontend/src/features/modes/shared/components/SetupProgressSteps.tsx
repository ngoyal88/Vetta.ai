import { ChevronRight } from 'lucide-react';

import { INTERVIEW_SETUP_STEPS } from '../constants/setupSteps';

type SetupProgressStepsProps = {
  activeStep?: number;
};

export function SetupProgressSteps({ activeStep = 1 }: SetupProgressStepsProps) {
  return (
    <ol
      className="flex shrink-0 flex-wrap items-center gap-2 md:gap-3"
      aria-label="Interview setup progress"
    >
      {INTERVIEW_SETUP_STEPS.map((step, index) => {
        const isActive = step.id === activeStep;
        return (
          <li key={step.id} className="flex items-center gap-2 md:gap-3">
            <div className={`flex items-center gap-2 ${isActive ? '' : 'opacity-55'}`}>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-luminous'
                    : 'border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)]'
                }`}
              >
                {step.id}
              </span>
              <span
                className={`type-label-sm whitespace-nowrap ${
                  isActive
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-on-surface-variant)]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < INTERVIEW_SETUP_STEPS.length - 1 ? (
              <ChevronRight
                className="hidden h-4 w-4 text-[var(--color-outline-variant)] sm:block"
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
