import { NavLink } from 'react-router-dom';

import { VAULT_SUB_NAV } from 'features/vault/constants/hubContent';

export default function VaultSubNav() {
  return (
    <nav className="vault-sub-nav" aria-label="Resume Vault sections">
      {VAULT_SUB_NAV.map(({ label, href, end }) => (
        <NavLink
          key={href}
          to={href}
          end={end}
          className={({ isActive }) =>
            ['vault-sub-nav__link', isActive ? 'vault-sub-nav__link--active' : ''].filter(Boolean).join(' ')
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
