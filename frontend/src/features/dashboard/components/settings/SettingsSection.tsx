import React, { memo, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type SettingsSectionVariant = 'primary' | 'secondary' | 'danger';

type SettingsSectionProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: SettingsSectionVariant;
  hero?: boolean;
};

function SettingsSectionComponent({
  icon: Icon,
  title,
  description,
  children,
  variant = 'secondary',
  hero = false,
}: SettingsSectionProps) {
  const sectionClass = [
    'settings-card',
    variant === 'primary' ? 'settings-card--primary' : '',
    variant === 'danger' ? 'settings-card--danger' : '',
    hero ? 'settings-card--hero' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconClass = [
    'settings-card__icon',
    variant === 'danger' ? 'settings-card__icon--danger' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={sectionClass}>
      {hero ? <div className="settings-card__hero-glow" aria-hidden /> : null}
      <header className="settings-card__header">
        <div className={iconClass} aria-hidden>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="settings-card__title">{title}</h2>
          {description ? <p className="settings-card__description">{description}</p> : null}
        </div>
      </header>
      <div className="settings-card__body">{children}</div>
    </section>
  );
}

export const SettingsSection = memo(SettingsSectionComponent);
