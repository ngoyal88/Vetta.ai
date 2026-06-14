import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import { vaultApi } from '../services/vaultApi';

const HUB = '/resume-vault';

export default function VaultBreadcrumb() {
  const { pathname } = useLocation();
  const { resumeId, versionId } = useParams<{ resumeId?: string; versionId?: string }>();
  const { entries } = useVaultLibraryContext();
  const [versionNumber, setVersionNumber] = useState<number | null>(null);

  const entry = resumeId ? entries.find((e) => e.id === resumeId) : null;

  useEffect(() => {
    if (!versionId) {
      setVersionNumber(null);
      return;
    }

    let cancelled = false;
    vaultApi
      .getVersion(versionId)
      .then((version) => {
        if (!cancelled) setVersionNumber(version.version_number);
      })
      .catch(() => {
        if (!cancelled) setVersionNumber(null);
      });

    return () => {
      cancelled = true;
    };
  }, [versionId]);

  const crumbs: { label: string; to?: string; badge?: string }[] = [{ label: 'Resume Vault', to: HUB }];

  if (pathname.includes('/library')) {
    crumbs.push({ label: 'Library' });
  } else if (pathname.includes('/compare')) {
    crumbs.push({ label: 'Compare', to: `${HUB}/compare` });
    if (pathname.includes('/compare/result')) {
      crumbs.push({ label: 'Result' });
    }
  } else if (resumeId && entry) {
    crumbs.push({ label: 'Library', to: `${HUB}/library` });
    if (versionId) {
      crumbs.push({ label: entry.name, to: `${HUB}/r/${resumeId}` });
      crumbs.push({
        label: '',
        badge: versionNumber != null ? `v${versionNumber}` : '…',
      });
    } else {
      crumbs.push({ label: entry.name });
    }
  }

  return (
    <nav
      aria-label="Vault breadcrumb"
      className="vault-breadcrumb type-label-sm mb-6 flex flex-wrap items-center gap-2 text-[var(--color-on-surface-variant)]"
    >
      <span className="text-[var(--color-on-surface-variant)] opacity-70">Workspace</span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      {crumbs.map((crumb, index) => (
        <React.Fragment key={`${crumb.label}-${index}`}>
          {index > 0 ? <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden /> : null}
          {crumb.to && index < crumbs.length - 1 ? (
            <Link to={crumb.to} className="transition-colors hover:text-[var(--color-primary)]">
              {crumb.label}
            </Link>
          ) : (
            <span
              className={[
                'inline-flex items-center gap-2',
                index === crumbs.length - 1 ? 'text-[var(--color-on-surface)]' : '',
              ].join(' ')}
            >
              {crumb.label ? (
                <span className={crumb.badge ? 'font-semibold' : undefined}>{crumb.label}</span>
              ) : null}
              {crumb.badge ? (
                <span className="vault-breadcrumb__version-badge">{crumb.badge}</span>
              ) : null}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
