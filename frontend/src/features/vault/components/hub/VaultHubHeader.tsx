import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';

import { MAX_RESUMES } from '../../utils/vaultUtils';

interface VaultHubHeaderProps {
  resumeCount: number;
}

export default function VaultHubHeader({ resumeCount }: VaultHubHeaderProps) {
  const atCapacity = resumeCount >= MAX_RESUMES;

  return (
    <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-1.5 type-label-sm text-[var(--color-outline)]"
        >
          <Link
            to="/dashboard"
            className="transition-colors hover:text-[var(--color-on-surface)]"
          >
            Workspace
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="text-[var(--color-primary)]">Resume Vault</span>
        </nav>

        <h1 className="type-headline-lg text-[var(--color-on-surface)]">Resume Vault</h1>
        <p className="type-body-md mt-2 max-w-2xl text-[var(--color-on-surface-variant)]">
          Store, version, and compare your resumes. Keep one active to power your interview
          intelligence.
        </p>
      </div>

      <div className="vault-hub-capacity shrink-0" aria-label={`${resumeCount} of ${MAX_RESUMES} resumes used`}>
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
