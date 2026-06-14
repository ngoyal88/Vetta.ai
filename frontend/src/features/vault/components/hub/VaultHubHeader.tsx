import React from 'react';
import { FileText } from 'lucide-react';

import { VAULT_HUB_COPY } from 'features/vault/constants/hubContent';
import { MAX_RESUMES } from 'features/vault/utils/vaultUtils';

type VaultHubHeaderProps = {
  resumeCount: number;
};

export default function VaultHubHeader({ resumeCount }: VaultHubHeaderProps) {
  const atCapacity = resumeCount >= MAX_RESUMES;

  return (
    <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl min-w-0">
        <p className="type-label-sm uppercase tracking-[0.24em] text-[var(--color-secondary)]">
          {VAULT_HUB_COPY.eyebrow}
        </p>
        <h1 className="type-display-lg mt-2 text-[var(--color-on-surface)]">{VAULT_HUB_COPY.title}</h1>
        <p className="type-body-lg mt-4 text-[var(--color-on-surface-variant)]">
          {VAULT_HUB_COPY.subtitle}
        </p>
      </div>

      <div
        className="vault-hub-capacity shrink-0"
        aria-label={`${resumeCount} of ${MAX_RESUMES} resumes used`}
      >
        <div className="vault-hub-capacity__icon" aria-hidden>
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-[var(--color-outline)]">
            Vault Capacity
          </span>
          <span className="type-label-md text-[var(--color-on-surface)]">
            <span className={atCapacity ? 'text-[var(--color-warning)]' : 'text-[var(--color-primary)]'}>
              {resumeCount}
            </span>
            <span className="text-[var(--color-on-surface-variant)]"> / {MAX_RESUMES}</span>
            <span className="ml-1 font-normal text-[var(--color-on-surface-variant)]">Resumes used</span>
          </span>
        </div>
      </div>
    </header>
  );
}
