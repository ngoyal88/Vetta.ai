import { Link } from 'react-router-dom';
import { ArrowRight, GitCompare } from 'lucide-react';

import { VAULT_HUB_COPY } from 'features/vault/constants/hubContent';

export default function VaultHubCompareCard() {
  return (
    <Link to="/resume-vault/compare" className="vault-hub-compare-card glass-panel group">
      <div className="vault-hub-compare-card__head">
        <div className="vault-hub-compare-card__icon" aria-hidden>
          <GitCompare className="h-5 w-5" />
        </div>
        <ArrowRight
          className="h-5 w-5 text-[var(--color-on-surface-variant)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-secondary)]"
          aria-hidden
        />
      </div>
      <h2 className="vault-hub-compare-card__title">{VAULT_HUB_COPY.compareCard.title}</h2>
      <p className="vault-hub-compare-card__description">{VAULT_HUB_COPY.compareCard.description}</p>
    </Link>
  );
}
