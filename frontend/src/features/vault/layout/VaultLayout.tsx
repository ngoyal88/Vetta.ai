import { Outlet, useLocation } from 'react-router-dom';

import VaultBreadcrumb from '../components/VaultBreadcrumb';
import { VaultLibraryProvider } from '../context/VaultLibraryContext';

export default function VaultLayout() {
  const { pathname } = useLocation();
  const isHub = pathname === '/resume-vault';

  return (
    <VaultLibraryProvider>
      <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg-0)] text-[var(--cream-1)]">
        {!isHub ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--cream-4) 18%, transparent) 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[color-mix(in_srgb,var(--teal-2)_6%,transparent)] via-transparent to-transparent" />
          </>
        ) : null}

        <div
          className={[
            'relative mx-auto w-full',
            isHub ? 'py-6 md:py-8' : 'max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8',
          ].join(' ')}
        >
          {!isHub ? <VaultBreadcrumb /> : null}
          <Outlet />
        </div>
      </div>
    </VaultLibraryProvider>
  );
}
