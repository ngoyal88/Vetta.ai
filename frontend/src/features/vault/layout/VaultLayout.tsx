import { Outlet, useLocation } from 'react-router-dom';

import '../vault.css';
import VaultBreadcrumb from '../components/VaultBreadcrumb';
import VaultShellChrome from '../components/shell/VaultShellChrome';
import { VaultLibraryProvider } from '../context/VaultLibraryContext';

const VAULT_SHELL_PREFIXES = [
  '/resume-vault/builder',
  '/resume-vault/library',
  '/resume-vault/compare',
];

function isVaultShellRoute(pathname: string): boolean {
  if (pathname === '/resume-vault') return true;
  return VAULT_SHELL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function VaultLayout() {
  const { pathname } = useLocation();
  const isShellPage = isVaultShellRoute(pathname);

  return (
    <VaultLibraryProvider>
      <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg-0)] text-[var(--cream-1)]">
        <div className={`vault-shell-page ${isShellPage ? 'vault-shell-page--framed pt-4 md:pt-5' : 'pt-10'} pb-14`}>
          {isShellPage ? (
            <div className="vault-shell-frame">
              <VaultShellChrome />
              <Outlet />
            </div>
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
