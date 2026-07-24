import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

type VaultHubPrimaryCardProps = {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  variant: 'primary' | 'secondary';
};

export default function VaultHubPrimaryCard({
  to,
  icon: Icon,
  title,
  description,
  cta,
  variant,
}: VaultHubPrimaryCardProps) {
  return (
    <article className="vault-hub-primary-card glass-panel">
      <div className="vault-hub-primary-card__icon" aria-hidden>
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="vault-hub-primary-card__title">{title}</h2>
      <p className="vault-hub-primary-card__description">{description}</p>
      <Link
        to={to}
        className={
          variant === 'primary' ? 'vault-hub-cta vault-hub-cta--primary' : 'vault-hub-cta vault-hub-cta--secondary'
        }
      >
        {cta}
      </Link>
    </article>
  );
}
