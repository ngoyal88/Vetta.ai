import { Link } from 'react-router-dom';

import { VAULT_HUB_COPY } from 'features/vault/constants/hubContent';

import VaultSubNav from './VaultSubNav';

export default function VaultShellChrome() {
  return (
    <div className="vault-shell-chrome">
      <div className="vault-shell-chrome__top">
        <nav className="vault-shell-breadcrumb" aria-label="Breadcrumb">
          <Link to="/dashboard" className="vault-shell-breadcrumb__link">
            {VAULT_HUB_COPY.breadcrumbWorkspace}
          </Link>
          <span className="vault-shell-breadcrumb__sep" aria-hidden>
            /
          </span>
          <span className="vault-shell-breadcrumb__current">{VAULT_HUB_COPY.breadcrumbVault}</span>
        </nav>

        <VaultSubNav />
      </div>
    </div>
  );
}
