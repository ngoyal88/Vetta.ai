type TargetDetailsFormProps = {
  targetRole: string;
  targetCompany: string;
  onRoleChange: (value: string) => void;
  onCompanyChange: (value: string) => void;
};

export function TargetDetailsForm({
  targetRole,
  targetCompany,
  onRoleChange,
  onCompanyChange,
}: TargetDetailsFormProps) {
  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6">
      <h2 className="type-label-md text-[var(--color-on-surface)]">Target details</h2>
      <div className="application-fit-panel-divider" aria-hidden />

      <div className="mt-5 space-y-5">
        <div className="space-y-2">
          <label htmlFor="job-title" className="type-label-sm text-[var(--color-on-surface-variant)]">
            Job Title <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="job-title"
            type="text"
            value={targetRole}
            onChange={(e) => onRoleChange(e.target.value)}
            placeholder="e.g., Senior UX Engineer"
            className="application-fit-target-input"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="company-name" className="type-label-sm text-[var(--color-on-surface-variant)]">
            Company Name <span className="opacity-50 font-normal">(Optional)</span>
          </label>
          <input
            id="company-name"
            type="text"
            value={targetCompany}
            onChange={(e) => onCompanyChange(e.target.value)}
            placeholder="e.g., Acme Corp"
            className="application-fit-target-input"
          />
        </div>
      </div>
    </div>
  );
}
