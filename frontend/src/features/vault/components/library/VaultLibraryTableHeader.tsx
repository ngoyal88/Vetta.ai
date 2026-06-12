import React from 'react';

import { VAULT_LIBRARY_COPY } from 'features/vault/constants/libraryContent';

export default function VaultLibraryTableHeader() {
  const { columns } = VAULT_LIBRARY_COPY;

  return (
    <div className="vault-library-table-header hidden md:grid" role="row" aria-hidden>
      <span className="col-span-5">{columns.documentName}</span>
      <span className="col-span-2 text-center">{columns.version}</span>
      <span className="col-span-2 text-center">{columns.aiScore}</span>
      <span className="col-span-2">{columns.tags}</span>
      <span className="col-span-1 text-right">{columns.actions}</span>
    </div>
  );
}
