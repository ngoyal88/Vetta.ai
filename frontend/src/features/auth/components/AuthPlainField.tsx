import type { InputHTMLAttributes, ReactNode } from 'react';

type AuthPlainFieldProps = {
  id: string;
  label: string;
  labelAction?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export function AuthPlainField({ id, label, labelAction, ...inputProps }: AuthPlainFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="type-label-md text-[var(--color-on-surface-variant)]">
          {label}
        </label>
        {labelAction}
      </div>
      <input id={id} className="auth-field-input" {...inputProps} />
    </div>
  );
}
