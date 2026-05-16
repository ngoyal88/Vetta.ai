import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { useVaultLibraryContext } from '../context/VaultLibraryContext';

const HUB = '/resume-vault';

export default function VaultBreadcrumb() {
  const { pathname } = useLocation();
  const { resumeId, versionId } = useParams<{ resumeId?: string; versionId?: string }>();
  const { entries } = useVaultLibraryContext();

  const entry = resumeId ? entries.find((e) => e.id === resumeId) : null;

  const crumbs: { label: string; to?: string }[] = [{ label: 'Resume Vault', to: HUB }];

  if (pathname.includes('/library')) {
    crumbs.push({ label: 'Library' });
  } else if (pathname.includes('/compare')) {
    crumbs.push({ label: 'Compare', to: `${HUB}/compare` });
    if (pathname.includes('/compare/result')) {
      crumbs.push({ label: 'Result' });
    }
  } else if (resumeId && entry) {
    crumbs.push({ label: 'Library', to: `${HUB}/library` });
    crumbs.push({ label: entry.name, to: `${HUB}/r/${resumeId}` });
    if (versionId) {
      crumbs.push({ label: 'Version detail' });
    }
  }

  return (
    <nav
      aria-label="Vault breadcrumb"
      className="mb-6 flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cream-4)]"
    >
      {crumbs.map((crumb, index) => (
        <React.Fragment key={`${crumb.label}-${index}`}>
          {index > 0 ? <span className="text-[var(--cream-4)]">›</span> : null}
          {crumb.to && index < crumbs.length - 1 ? (
            <Link to={crumb.to} className="transition hover:text-[var(--teal-1)]">
              {crumb.label}
            </Link>
          ) : (
            <span className={index === crumbs.length - 1 ? 'text-[var(--cream-2)]' : undefined}>
              {crumb.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
