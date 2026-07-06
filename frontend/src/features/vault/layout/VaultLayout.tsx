import { Outlet, useLocation } from 'react-router-dom';

import '../vault.css';
import VaultBreadcrumb from '../components/VaultBreadcrumb';
import { VaultLibraryProvider } from '../context/VaultLibraryContext';

const VAULT_SHELL_PATHS = new Set(['/resume-vault', '/resume-vault/library']);

export default function VaultLayout() {
  const { pathname } = useLocation();
  const isBuilderPage = pathname.startsWith('/resume-vault/builder');
  const isShellPage = VAULT_SHELL_PATHS.has(pathname) || isBuilderPage;

  return (
    <VaultLibraryProvider>
      <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg-0)] text-[var(--cream-1)]">
        <div className={`vault-shell-page pb-14 ${isBuilderPage ? 'pt-4 md:pt-5' : 'pt-10'}`}>
          {isShellPage ? (
            isBuilderPage ? (
              <div className="mx-auto w-full max-w-[1440px] px-3 md:px-5 xl:px-6">
                <Outlet />
              </div>
            ) : (
              <Outlet />
            )
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
