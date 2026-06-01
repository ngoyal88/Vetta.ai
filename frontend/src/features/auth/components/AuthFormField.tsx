import type { InputHTMLAttributes, ReactNode } from 'react';

type AuthFormFieldProps = {
  id: string;
  label: string;
  icon: ReactNode;
  hint?: string;
  suffix?: ReactNode;
  compact?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

export function AuthFormField({
  id,
  label,
  icon,
  hint,
  suffix,
  compact = false,
  className = '',
  ...inputProps
}: AuthFormFieldProps) {
  return (
    <div className={compact ? 'auth-field-compact' : 'space-y-2'}>
      <label htmlFor={id} className="type-label-md text-[var(--color-on-surface-variant)]">
        {label}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-outline)]"
          aria-hidden="true"
        >
          {icon}
        </span>
        <input
          id={id}
          className={`auth-input ${suffix ? 'pr-10' : ''} ${className}`.trim()}
          {...inputProps}
        />
        {suffix}
      </div>
      {hint ? (
        <p className="type-label-sm text-[var(--color-outline)] text-right">{hint}</p>
      ) : null}
    </div>
  );
}
