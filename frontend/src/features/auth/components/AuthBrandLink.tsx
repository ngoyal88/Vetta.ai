import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type AuthBrandLinkProps = {
  icon: ReactNode;
  label?: string;
  className?: string;
  labelClassName?: string;
};

export function AuthBrandLink({
  icon,
  label = 'Vetta.ai',
  className = '',
  labelClassName = 'type-headline-md text-[var(--color-on-surface)]',
}: AuthBrandLinkProps) {
  return (
    <Link
      to="/"
      className={`auth-brand-link inline-flex items-center gap-2 transition-opacity hover:opacity-90 ${className}`.trim()}
      aria-label="Vetta.ai home"
    >
      {icon}
      <span className={labelClassName}>{label}</span>
    </Link>
  );
}
