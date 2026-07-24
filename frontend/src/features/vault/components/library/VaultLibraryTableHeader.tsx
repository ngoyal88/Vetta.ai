import React from 'react';

import { VAULT_LIBRARY_COPY } from 'features/vault/constants/libraryContent';

export default function VaultLibraryTableHeader() {
  return (
    <div className="vault-library-table-header" role="row" aria-hidden>
      <span className="vault-library-table-header__label">{VAULT_LIBRARY_COPY.columns.documentName}</span>
    </div>
  );
}
