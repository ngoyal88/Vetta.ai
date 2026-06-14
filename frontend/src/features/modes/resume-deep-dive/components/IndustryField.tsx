import React from 'react';
import { Building2 } from 'lucide-react';

type IndustryFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  listId: string;
};

export function IndustryField({ id, value, onChange, listId }: IndustryFieldProps) {
  return (
    <div className="role-targeted-combobox flex flex-col gap-2">
      <label
        htmlFor={id}
        className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]"
      >
        Target industry
      </label>
      <div className="role-targeted-combobox__control">
        <Building2 className="role-targeted-combobox__icon pointer-events-none" aria-hidden />
        <input
          id={id}
          type="text"
          list={listId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Fintech / AI SaaS"
          className="role-targeted-combobox__input"
        />
      </div>
    </div>
  );
}
