import { Check, Brain } from 'lucide-react';

import type { ComputeResponse } from '../../types/applicationFitTypes';

type SkillChipsSectionProps = {
  report: ComputeResponse;
};

const CHIP_CLASS = {
  matched: 'application-fit-skill-chip application-fit-skill-chip--matched',
  boostable: 'application-fit-skill-chip application-fit-skill-chip--boostable',
  missing: 'application-fit-skill-chip application-fit-skill-chip--missing',
} as const;

export function SkillChipsSection({ report }: SkillChipsSectionProps) {
  const missingFromAts = report.funnel.ats.missing_keywords.filter(
    (kw) => !report.missing_skills.some((s) => s.toLowerCase() === kw.toLowerCase()),
  );

  return (
    <section className="glass-panel application-fit-panel">
      <h3 className="application-fit-panel-title type-headline-md text-[var(--color-on-surface)]">
        Keyword Topography
      </h3>
      <div className="space-y-4">
        <div>
          <span className="mb-2 block type-label-sm uppercase tracking-wider text-[var(--color-on-surface-variant)]">
            Matched
          </span>
          <div className="flex flex-wrap gap-2">
            {report.matched_skills.length ? (
              report.matched_skills.map((skill) => (
                <span key={skill} className={CHIP_CLASS.matched}>
                  <Check className="h-3 w-3 shrink-0" aria-hidden />
                  {skill}
                </span>
              ))
            ) : (
              <span className="type-body-md text-[var(--color-on-surface-variant)]">None detected</span>
            )}
          </div>
        </div>
        {report.vpm_boostable_skills.length > 0 ? (
          <div>
            <span className="mb-2 block type-label-sm uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Boostable (VPM)
            </span>
            <div className="flex flex-wrap gap-2">
              {report.vpm_boostable_skills.map((skill) => (
                <span key={skill} className={CHIP_CLASS.boostable}>
                  {skill}
                  <Brain className="h-3 w-3 shrink-0" aria-hidden />
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <span className="mb-2 block type-label-sm uppercase tracking-wider text-[var(--color-error)]/80">
            Missing Signal
          </span>
          <div className="flex flex-wrap gap-2">
            {[...report.missing_skills, ...missingFromAts].slice(0, 12).map((skill) => (
              <span key={skill} className={CHIP_CLASS.missing}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
