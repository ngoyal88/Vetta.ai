import React, { memo } from 'react';
import { motion, type MotionProps } from 'framer-motion';
import { BriefcaseBusiness, Building2, Target } from 'lucide-react';

import { RoleTargetedCombobox } from './RoleTargetedCombobox';
import { COMPANY_OPTIONS, ROLE_OPTIONS } from '../constants/roleTargetedOptions';
import { SECTION_ICON_CLASS } from '../constants/focusOptions';

type TargetRoleSectionProps = {
  motionProps: MotionProps;
  company: string;
  role: string;
  onCompanyChange: (value: string) => void;
  onRoleChange: (value: string) => void;
};

function TargetRoleSectionComponent({
  motionProps,
  company,
  role,
  onCompanyChange,
  onRoleChange,
}: TargetRoleSectionProps) {
  return (
    <motion.section
      {...motionProps}
      className="glass-panel group relative z-20 overflow-visible rounded-2xl p-5 md:p-6"
      aria-labelledby="target-position-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative z-10 flex items-center gap-3">
        <div
          className={`${SECTION_ICON_CLASS} border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[var(--color-primary)]`}
        >
          <Target className="h-5 w-5" aria-hidden />
        </div>
        <h2 id="target-position-heading" className="type-headline-md text-[var(--color-on-surface)]">
          Target position
        </h2>
      </div>
      <div className="relative z-10 mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <RoleTargetedCombobox
          id="target-company"
          label="Target company"
          icon={Building2}
          value={company}
          onChange={onCompanyChange}
          options={COMPANY_OPTIONS}
          placeholder="e.g. Stripe or Unknown"
          inputAutoComplete="organization"
          emptyHint="Popular companies"
        />
        <RoleTargetedCombobox
          id="target-role"
          label={
            <>
              Target role <span className="text-[var(--color-error)]">*</span>
            </>
          }
          icon={BriefcaseBusiness}
          value={role}
          onChange={onRoleChange}
          options={ROLE_OPTIONS}
          placeholder="e.g. Senior Frontend Engineer"
          required
          inputAutoComplete="organization-title"
          emptyHint="Common engineering roles"
        />
      </div>
    </motion.section>
  );
}

export const TargetRoleSection = memo(TargetRoleSectionComponent);
