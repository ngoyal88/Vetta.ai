import { ListChecks } from 'lucide-react';

import type { ComputeResponse } from '../../types/applicationFitTypes';
import { ActionCard } from './ActionCard';

type RankedActionListProps = {
  report: ComputeResponse;
  targetRole: string;
};

export function RankedActionList({ report, targetRole }: RankedActionListProps) {
  return (
    <section id="application-fit-actions" className="glass-panel application-fit-panel h-full">
      <h3 className="application-fit-panel-title type-headline-md flex items-center gap-2 text-[var(--color-on-surface)]">
        <ListChecks className="h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
        Fix these first
      </h3>
      <p className="mb-4 type-body-sm text-[var(--color-on-surface-variant)]">
        Start with the top action. It should move the bottleneck fastest.
      </p>
      <div className="flex flex-col gap-2.5">
        {report.ranked_actions.map((action, index) => (
          <ActionCard
            key={`${action.label}-${index}`}
            action={action}
            report={report}
            targetRole={targetRole}
          />
        ))}
      </div>
    </section>
  );
}
