import React from 'react';
import { BriefcaseBusiness, SlidersHorizontal } from 'lucide-react';

import { RoleTargetedCombobox } from 'features/modes/role-targeted/components/RoleTargetedCombobox';
import { ROLE_OPTIONS } from 'features/modes/role-targeted/constants/roleTargetedOptions';
import { OBJECTIVE_OPTIONS, SCAN_DEPTH_STOPS, type ObjectiveId } from '../constants/resumeDeepDiveOptions';
import { getScanDepthStop } from '../utils/resumeDeepDiveUtils';
import { IndustryField } from './IndustryField';
import { SectionHeading } from './SectionHeading';

type AnalysisParametersSectionProps = {
  objectives: ObjectiveId[];
  onToggleObjective: (id: ObjectiveId) => void;
  scanDepthValue: number;
  onScanDepthChange: (value: number) => void;
  targetRole: string;
  onTargetRoleChange: (value: string) => void;
  targetIndustry: string;
  onTargetIndustryChange: (value: string) => void;
  industryListId: string;
};

export function AnalysisParametersSection({
  objectives,
  onToggleObjective,
  scanDepthValue,
  onScanDepthChange,
  targetRole,
  onTargetRoleChange,
  targetIndustry,
  onTargetIndustryChange,
  industryListId,
}: AnalysisParametersSectionProps) {
  const activeScanStop = getScanDepthStop(scanDepthValue);
  const scanDepthProgress = `${((scanDepthValue - 1) / (SCAN_DEPTH_STOPS.length - 1)) * 100}%`;

  return (
    <section aria-labelledby="analysis-parameters-heading">
      <SectionHeading
        id="analysis-parameters-heading"
        title="Analysis parameters"
        icon={SlidersHorizontal}
        accent="secondary"
      />

      <div className="space-y-8">
        <fieldset className="border-0 p-0">
          <legend className="type-label-sm mb-4 uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
            Primary objective
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {OBJECTIVE_OPTIONS.map((option) => {
              const selected = objectives.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggleObjective(option.id)}
                  className={`resume-deep-dive-chip ${selected ? 'resume-deep-dive-chip--active' : ''}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="range-slider-field">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="scan-depth-slider"
              className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]"
            >
              Scan depth
            </label>
            <span className="inline-flex items-center rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2.5 py-1 font-mono text-xs leading-none text-[var(--color-primary)]">
              {activeScanStop.badge}
            </span>
          </div>
          <input
            id="scan-depth-slider"
            type="range"
            min={1}
            max={3}
            step={1}
            value={scanDepthValue}
            onChange={(e) => onScanDepthChange(Number(e.target.value))}
            className="range-slider"
            style={{ ['--slider-progress' as string]: scanDepthProgress }}
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={scanDepthValue}
            aria-valuetext={activeScanStop.badge}
          />
          <div className="flex justify-between type-label-sm text-[var(--color-outline)]">
            {SCAN_DEPTH_STOPS.map((stop) => (
              <button
                key={stop.value}
                type="button"
                onClick={() => onScanDepthChange(stop.value)}
                className={
                  stop.value === scanDepthValue
                    ? 'text-[var(--color-primary)]'
                    : 'transition-colors hover:text-[var(--color-on-surface-variant)]'
                }
              >
                {stop.stopLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-end">
          <RoleTargetedCombobox
            id="deep-dive-target-role"
            label="Target role"
            icon={BriefcaseBusiness}
            value={targetRole}
            onChange={onTargetRoleChange}
            options={ROLE_OPTIONS}
            placeholder="e.g. Senior Frontend Engineer"
            emptyHint="Common engineering roles"
          />
          <IndustryField
            id="target-industry"
            value={targetIndustry}
            onChange={onTargetIndustryChange}
            listId={industryListId}
          />
        </div>
      </div>
    </section>
  );
}
