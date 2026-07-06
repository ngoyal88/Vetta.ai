import React from 'react';
import { Link } from 'react-router-dom';

import VaultEditMetaModal from 'features/vault/components/VaultEditMetaModal';
import { VaultAddVersionModal, VaultVersionCard, VaultVersionsHeader } from 'features/vault/components/versions';
import PageLoadingState from 'shared/components/PageLoadingState';
import { VAULT_VERSIONS_COPY } from 'features/vault/constants/versionsContent';
import { useVersionsPage } from 'features/vault/hooks/useVersionsPage';

export default function VaultVersionsPage() {
  const {
    resumeId,
    entry,
    entryNotFound,
    versions,
    headVersion,
    compatScore,
    loading,
    error,
    refresh,
    editOpen,
    addVersionOpen,
    uploadingVersion,
    editName,
    editTags,
    savingMeta,
    pendingAction,
    setEditName,
    setEditTags,
    openEdit,
    closeEdit,
    openAddVersion,
    closeAddVersion,
    uploadVersion,
    saveMeta,
    previewVersion,
    openInBuilder,
    downloadVersion,
    compareVersion,
    restoreVersionById,
    isCurrentVersion,
  } = useVersionsPage();

  const copy = VAULT_VERSIONS_COPY;

  if (!resumeId) {
    return <p className="type-body-md text-[var(--color-on-surface-variant)]">{copy.invalidResume}</p>;
  }

  if (entryNotFound) {
    return (
      <div className="glass-panel rounded-xl py-16 text-center">
        <p className="type-body-md text-[var(--color-on-surface-variant)]">{copy.notFound}</p>
        <Link
          to="/resume-vault/library"
          className="type-label-md mt-4 inline-block text-[var(--color-primary)] hover:underline"
        >
          {copy.backToLibrary}
        </Link>
      </div>
    );
  }

  return (
    <>
      <VaultVersionsHeader
        entry={entry}
        headVersion={headVersion}
        compatScore={compatScore}
        onEdit={openEdit}
        onAddVersion={openAddVersion}
      />

      {loading ? (
        <PageLoadingState variant="cards" minHeightClassName="py-6" />
      ) : error ? (
        <div className="glass-panel rounded-xl py-16 text-center">
          <p className="type-body-md text-[var(--color-error)]">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="type-label-md mt-4 rounded-lg border border-[var(--border-strong)] px-4 py-2 text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-high)]"
          >
            {copy.retry}
          </button>
        </div>
      ) : !versions.length ? (
        <div className="glass-panel rounded-xl border border-dashed border-[var(--border-strong)] py-16 text-center">
          <p className="type-headline-md text-[var(--color-on-surface)]">{copy.emptyTitle}</p>
          <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">{copy.empty}</p>
          {entry ? (
            <button
              type="button"
              onClick={openAddVersion}
              className="vault-versions-action-btn vault-versions-action-btn--primary mt-6"
            >
              {copy.newVersion}
            </button>
          ) : null}
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" aria-label="Resume versions">
          {versions.map((version) => (
            <VaultVersionCard
              key={version.id}
              version={version}
              isCurrent={isCurrentVersion(version)}
              pendingAction={pendingAction}
              onPreview={previewVersion}
              onOpenInBuilder={openInBuilder}
              onDownload={downloadVersion}
              onCompare={compareVersion}
              onRestore={restoreVersionById}
            />
          ))}
        </section>
      )}

      <VaultEditMetaModal
        open={editOpen}
        entry={entry || null}
        editName={editName}
        editTags={editTags}
        saving={savingMeta}
        onNameChange={setEditName}
        onTagsChange={setEditTags}
        onClose={closeEdit}
        onSave={() => void saveMeta()}
      />

      <VaultAddVersionModal
        open={addVersionOpen}
        entry={entry || null}
        uploading={uploadingVersion}
        onClose={closeAddVersion}
        onUpload={uploadVersion}
      />
    </>
  );
}
