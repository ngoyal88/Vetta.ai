import React, { memo } from 'react';
import { motion, type MotionProps } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

import { ROLE_TARGETED_DIFFICULTY_STOPS } from 'features/modes/shared/constants/difficultyStops';
import { FOCUS_OPTIONS, SECTION_ICON_CLASS } from '../constants/focusOptions';
import { FocusOptionToggle } from './FocusOptionToggle';

type CalibrationSectionProps = {
  motionProps: MotionProps;
  focusSelections: string[];
  difficultyValue: number;
  difficultyLabel: string;
  difficultyProgress: string;
  yoeValue: number;
  yoeLabel: string;
  yoeProgress: string;
  onToggleFocus: (value: string) => void;
  onDifficultyChange: (value: number) => void;
  onYoeChange: (value: number) => void;
};

function CalibrationSectionComponent({
  motionProps,
  focusSelections,
  difficultyValue,
  difficultyLabel,
  difficultyProgress,
  yoeValue,
  yoeLabel,
  yoeProgress,
  onToggleFocus,
  onDifficultyChange,
  onYoeChange,
}: CalibrationSectionProps) {
  return (
    <motion.section
      {...motionProps}
      className="glass-panel rounded-2xl p-5 md:p-6"
      aria-labelledby="session-params-heading"
    >
      <div className="flex items-center gap-3">
        <div
          className={`${SECTION_ICON_CLASS} border-[var(--color-tertiary)]/25 bg-[var(--color-tertiary)]/10 text-[var(--color-tertiary)]`}
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
        </div>
        <h2 id="session-params-heading" className="type-headline-md text-[var(--color-on-surface)]">
          Session parameters
        </h2>
      </div>

      <div className="mt-5 space-y-8">
        <fieldset className="space-y-3 border-0 p-0">
          <legend className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
            Interview focus
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {FOCUS_OPTIONS.map(({ value, label, icon }) => (
              <FocusOptionToggle
                key={value}
                value={value}
                label={label}
                icon={icon}
                selected={focusSelections.includes(value)}
                onToggle={onToggleFocus}
              />
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="range-slider-field">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="difficulty-slider"
                className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]"
              >
                Difficulty caliber
              </label>
              <span className="inline-flex items-center rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2.5 py-1 font-mono text-xs leading-none text-[var(--color-primary)]">
                {difficultyLabel}
              </span>
            </div>
            <input
              id="difficulty-slider"
              type="range"
              min={1}
              max={3}
              step={1}
              value={difficultyValue}
              onChange={(e) => onDifficultyChange(Number(e.target.value))}
              className="range-slider"
              style={{ ['--slider-progress' as string]: difficultyProgress }}
              aria-valuemin={1}
              aria-valuemax={3}
              aria-valuenow={difficultyValue}
              aria-valuetext={difficultyLabel}
            />
            <div className="flex justify-between type-label-sm text-[var(--color-outline)]">
              {ROLE_TARGETED_DIFFICULTY_STOPS.map((stop) => (
                <span
                  key={stop.value}
                  className={stop.value === difficultyValue ? 'text-[var(--color-primary)]' : undefined}
                >
                  {stop.stopLabel}
                </span>
              ))}
            </div>
          </div>

          <div className="range-slider-field">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="yoe-slider"
                className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]"
              >
                Simulated YOE
              </label>
              <span className="inline-flex items-center rounded-full border border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/10 px-2.5 py-1 font-mono text-xs leading-none text-[var(--color-secondary)]">
                {yoeLabel}
              </span>
            </div>
            <input
              id="yoe-slider"
              type="range"
              min={0}
              max={15}
              value={yoeValue}
              onChange={(e) => onYoeChange(Number(e.target.value))}
              className="range-slider"
              style={{ ['--slider-progress' as string]: yoeProgress }}
              aria-valuemin={0}
              aria-valuemax={15}
              aria-valuenow={yoeValue}
              aria-valuetext={yoeLabel}
            />
            <div className="flex justify-between type-label-sm text-[var(--color-outline)]">
              <span>Entry</span>
              <span>Mid</span>
              <span>Senior</span>
              <span>Staff+</span>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export const CalibrationSection = memo(CalibrationSectionComponent);
