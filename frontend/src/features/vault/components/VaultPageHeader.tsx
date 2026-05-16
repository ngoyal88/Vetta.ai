import React from 'react';

import { MAX_RESUMES } from '../utils/vaultUtils';

interface VaultPageHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
  resumeCount?: number;
}

export default function VaultPageHeader({
  label = 'Resume Vault',
  title,
  subtitle,
  resumeCount,
}: VaultPageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--teal-1)]">{label}</p>
        <h1 className="mt-2 text-2xl font-medium text-[var(--cream-0)]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-[var(--cream-2)]">{subtitle}</p> : null}
      </div>
      {typeof resumeCount === 'number' ? (
        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-1)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cream-3)]">
          {resumeCount}/{MAX_RESUMES} resumes
        </span>
      ) : null}
    </div>
  );
}
