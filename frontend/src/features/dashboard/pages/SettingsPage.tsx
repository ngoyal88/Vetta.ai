import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import { SettingsDangerSection } from '../components/settings/SettingsDangerSection';
import { SettingsDataSection } from '../components/settings/SettingsDataSection';
import { SettingsIdentitySection } from '../components/settings/SettingsIdentitySection';
import { SettingsInterviewSection } from '../components/settings/SettingsInterviewSection';
import { SettingsPlanSection } from '../components/settings/SettingsPlanSection';
import { useSettingsPage } from '../hooks/useSettingsPage';

const fadeUpTransition = {
  duration: 0.45,
  ease: 'easeOut' as const,
};

const SettingsPage: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const settings = useSettingsPage();

  const headerMotion = useMemo(
    () =>
      reduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            transition: fadeUpTransition,
          },
    [reduceMotion],
  );

  if (settings.loading) {
    return (
      <div className="settings-page">
        <div className="app-container settings-page__inner">
          <div className="settings-page__loading">
            <div className="settings-page__spinner" />
            <p className="type-body-md text-[var(--color-on-surface-variant)]">Loading settings…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!settings.currentUser) {
    return null;
  }

  const user = settings.currentUser;

  return (
    <div className="settings-page">
      <div className="app-container settings-page__inner">
        <motion.header {...headerMotion} className="settings-page__header">
          <nav className="settings-page__breadcrumb" aria-label="Breadcrumb">
            <span className="settings-page__breadcrumb-root">Workspace</span>
            <ChevronRight className="settings-page__breadcrumb-sep" aria-hidden />
            <span className="settings-page__breadcrumb-current">Settings</span>
          </nav>
          <h1 className="type-headline-lg text-[var(--color-on-surface)]">Settings</h1>
          <p className="type-body-md settings-page__subtitle">
            Account identity, interview defaults, and data controls for your command center.
          </p>
        </motion.header>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...fadeUpTransition, delay: 0.06 }}
          className="settings-page__bento"
        >
          <div className="settings-page__primary">
            <SettingsIdentitySection
              user={user}
              displayName={settings.displayName}
              photoUrl={settings.photoUrl}
              saving={settings.saving}
              sendingVerification={settings.sendingVerification}
              sendingReset={settings.sendingReset}
              onDisplayNameChange={settings.setDisplayName}
              onPhotoUrlChange={settings.setPhotoUrl}
              onSave={settings.saveSettings}
              onSendVerification={settings.handleSendVerification}
              onResetPassword={settings.handleResetPassword}
            />

            <SettingsInterviewSection
              defaultRole={settings.defaultRole}
              defaultYoe={settings.defaultYoe}
              skipPrecheck={settings.skipPrecheck}
              saving={settings.saving}
              onDefaultRoleChange={settings.setDefaultRole}
              onDefaultYoeChange={settings.setDefaultYoe}
              onSkipPrecheckChange={settings.handleSkipPrecheckChange}
              onSave={settings.saveSettings}
            />
          </div>

          <div className="settings-page__secondary">
            <SettingsPlanSection />
            <SettingsDataSection />
            <SettingsDangerSection
              user={user}
              deleting={settings.deleting}
              onDeleteAccount={settings.handleDeleteAccount}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;
