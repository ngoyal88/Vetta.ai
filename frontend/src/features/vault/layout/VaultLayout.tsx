import { Outlet, useLocation } from 'react-router-dom';

import '../vault.css';
import VaultBreadcrumb from '../components/VaultBreadcrumb';
import { VaultLibraryProvider } from '../context/VaultLibraryContext';

const VAULT_SHELL_PATHS = new Set(['/resume-vault', '/resume-vault/library']);

export default function VaultLayout() {
  const { pathname } = useLocation();
  const isShellPage = VAULT_SHELL_PATHS.has(pathname);

  return (
    <VaultLibraryProvider>
      <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg-0)] text-[var(--cream-1)]">
        <div className="vault-shell-page pb-14 pt-10">
          {isShellPage ? (
            <Outlet />
          ) : (
            <div className="app-container">
              <VaultBreadcrumb />
              <Outlet />
            </div>
          )}
        </div>
      </div>
    </VaultLibraryProvider>
  );
}
