import SaveDraftModal from '../SaveDraftModal';
import type { useBuilderLanding } from '../../hooks/useBuilderLanding';

import BuilderDraftHub from './BuilderDraftHub';
import BuilderEntryCards from './BuilderEntryCards';
import VaultPickerModal from './VaultPickerModal';

type BuilderLandingViewProps = {
  landing: ReturnType<typeof useBuilderLanding>;
  vaultEntryCount: number;
};

export default function BuilderLandingView({ landing, vaultEntryCount }: BuilderLandingViewProps) {
  return (
    <div className="space-y-10">
      <p className="sr-only" aria-live="polite">
        {landing.statusMessage}
      </p>

      <header className="max-w-3xl min-w-0">
        <h1 className="type-display-lg text-[var(--color-on-surface)]">
          Build a resume that interviews can use
        </h1>
        <p className="type-body-lg mt-4 text-[var(--color-on-surface-variant)]">
          Start from scratch or a resume you already uploaded — choose a layout while editing.
        </p>
        {!landing.profileReady ? (
          <p className="type-body-md mt-4 text-[var(--color-on-surface-variant)]">
            Add your name and email in{' '}
            <a href="/profile" className="text-[var(--color-primary)] underline-offset-2 hover:underline">
              Profile
            </a>{' '}
            before creating a draft.
          </p>
        ) : null}
      </header>

      <BuilderEntryCards landing={landing} vaultEntryCount={vaultEntryCount} />
      <BuilderDraftHub landing={landing} />

      <VaultPickerModal
        open={landing.vaultPickerOpen}
        saving={landing.saving}
        onClose={landing.closeVaultPicker}
        onSelect={(resumeId) => void landing.createDraftFromVault(resumeId)}
      />

      <SaveDraftModal
        open={Boolean(landing.renameTarget)}
        saving={landing.saving}
        defaultName={landing.renameTarget?.defaultName ?? ''}
        title="Rename draft"
        description="Choose a name you will recognize on the Builder landing page."
        submitLabel="Rename"
        onClose={landing.closeRename}
        onSubmit={(name) => {
          if (landing.renameTarget) {
            void landing.renameDraft(landing.renameTarget.draftId, name);
          }
        }}
      />
    </div>
  );
}
