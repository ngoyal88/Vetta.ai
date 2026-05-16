import React, { createContext, useContext } from 'react';

import { useVaultLibrary } from '../hooks/useVaultLibrary';

type VaultLibraryValue = ReturnType<typeof useVaultLibrary>;

const VaultLibraryContext = createContext<VaultLibraryValue | null>(null);

export function VaultLibraryProvider({ children }: { children: React.ReactNode }) {
  const library = useVaultLibrary();
  return <VaultLibraryContext.Provider value={library}>{children}</VaultLibraryContext.Provider>;
}

export function useVaultLibraryContext(): VaultLibraryValue {
  const ctx = useContext(VaultLibraryContext);
  if (!ctx) {
    throw new Error('useVaultLibraryContext must be used within VaultLibraryProvider');
  }
  return ctx;
}
