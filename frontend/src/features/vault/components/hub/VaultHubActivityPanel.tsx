import { Link } from 'react-router-dom';
import { CheckCircle2, FilePenLine } from 'lucide-react';

import { VAULT_HUB_COPY } from 'features/vault/constants/hubContent';
import type { VaultEntry } from 'features/vault/types';

type VaultHubActivityPanelProps = {
  entries: VaultEntry[];
  activeResumeId: string | null;
  recentDraft?: { id: string; label: string } | null;
  showDrafts?: boolean;
};

export default function VaultHubActivityPanel({
  entries,
  activeResumeId,
  recentDraft = null,
  showDrafts = false,
}: VaultHubActivityPanelProps) {
  const activeEntry =
    entries.find((entry) => entry.id === activeResumeId) ?? entries.find((entry) => entry.is_active);

  return (
    <section className="vault-hub-activity glass-panel">
      <h2 className="vault-hub-activity__title">{VAULT_HUB_COPY.activity.title}</h2>

      <div className="vault-hub-activity__list">
        <div className="vault-hub-activity__item">
          <div className="vault-hub-activity__item-head">
            <span className="vault-hub-activity__badge vault-hub-activity__badge--active">
              {VAULT_HUB_COPY.activity.activeLabel}
            </span>
            <CheckCircle2 className="h-4 w-4 text-[var(--color-secondary)]" aria-hidden />
          </div>
          {activeEntry ? (
            <Link to={`/resume-vault/r/${activeEntry.id}`} className="vault-hub-activity__link">
              {activeEntry.name}
            </Link>
          ) : (
            <p className="vault-hub-activity__empty">{VAULT_HUB_COPY.activity.noActive}</p>
          )}
        </div>

        {showDrafts ? (
          <div className="vault-hub-activity__item">
            <div className="vault-hub-activity__item-head">
              <span className="vault-hub-activity__badge">{VAULT_HUB_COPY.activity.draftLabel}</span>
              <FilePenLine className="h-4 w-4 text-[var(--color-on-surface-variant)]" aria-hidden />
            </div>
            {recentDraft ? (
              <Link to={`/resume-vault/builder/${recentDraft.id}`} className="vault-hub-activity__link">
                {recentDraft.label}
              </Link>
            ) : (
              <p className="vault-hub-activity__empty">{VAULT_HUB_COPY.activity.noDraft}</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
