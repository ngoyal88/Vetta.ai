import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

import { SettingsSection } from './SettingsSection';

function SettingsPlanSectionComponent() {
  return (
    <SettingsSection
      icon={Sparkles}
      title="Plan"
      description="Your workspace tier and upgrade options."
    >
      <div className="settings-plan-panel">
        <p className="settings-plan-panel__tier">Free</p>
        <p className="settings-plan-panel__copy">
          Core mock interviews, vault storage, and session history.
        </p>
        <Link to="/pricing" className="settings-btn settings-btn--primary">
          Upgrade to Pro
        </Link>
      </div>
    </SettingsSection>
  );
}

export const SettingsPlanSection = memo(SettingsPlanSectionComponent);
