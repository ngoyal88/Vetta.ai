import React from 'react';

import { VAULT_COMPARE_COPY } from 'features/vault/constants/compareContent';

export default function VaultCompareHeader() {
  const copy = VAULT_COMPARE_COPY;

  return (
    <header className="mb-8">
      <p className="type-label-sm uppercase tracking-[0.24em] text-[var(--color-secondary)]">
        {copy.eyebrow}
      </p>
      <h1 className="type-headline-lg mt-2 text-[var(--color-on-surface)]">{copy.title}</h1>
      <p className="type-body-md mt-4 max-w-2xl text-[var(--color-on-surface-variant)]">{copy.subtitle}</p>
    </header>
  );
}
