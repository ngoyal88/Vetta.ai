import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  VaultVersionDetailDocumentPanel,
  VaultVersionDetailInsights,
} from 'features/vault/components/version-detail';
import { VAULT_VERSION_DETAIL_COPY } from 'features/vault/constants/versionDetailContent';
import { useVersionDetailPage } from 'features/vault/hooks/useVersionDetailPage';
import { formatFileSize } from 'features/vault/utils/versionDetailPresentation';

export default function VaultVersionDetailPage() {
  const copy = VAULT_VERSION_DETAIL_COPY;
  const {
    resumeId,
    entry,
    version,
    presentation,
    loading,
    error,
    mobileTab,
    setMobileTab,
    reanalyzing,
    pendingRestore,
    pendingActive,
    handleReanalyze,
    handleRestore,
    handleSetActive,
  } = useVersionDetailPage();

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileSizeLabel, setFileSizeLabel] = useState<string | null>(null);

  const handleBlobReady = useCallback((blobUrl: string | null) => {
    setDownloadUrl(blobUrl);
    if (!blobUrl) setFileSizeLabel(null);
  }, []);

  const handleFileSize = useCallback((sizeBytes: number | null) => {
    setFileSizeLabel(formatFileSize(sizeBytes));
  }, []);

  const handleDownload = () => {
    if (!downloadUrl || !presentation) return;
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = presentation.filename;
    anchor.click();
  };

  if (!resumeId) {
    return <p className="text-sm text-[var(--color-on-surface-variant)]">{copy.invalidRoute}</p>;
  }

  if (!loading && error) {
    return (
      <div className="vault-version-detail__error glass-panel">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
        <Link to={`/resume-vault/r/${resumeId}`} className="vault-version-detail__back-link">
          {copy.backToVersions}
        </Link>
      </div>
    );
  }

  return (
    <div className="vault-version-detail-page">
      <div className="vault-version-detail-page__mobile-tabs lg:hidden">
        {(['document', 'insights'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={[
              'vault-version-detail-page__mobile-tab',
              mobileTab === tab ? 'vault-version-detail-page__mobile-tab--active' : '',
            ].join(' ')}
          >
            {tab === 'document' ? copy.documentTab : copy.insightsTab}
          </button>
        ))}
      </div>

      {loading || !version || !presentation ? (
        <p className="vault-version-detail-page__loading">{copy.loading}</p>
      ) : (
        <div className="vault-version-detail-page__layout">
          <div className={mobileTab === 'insights' ? 'block' : 'hidden lg:block'}>
            <VaultVersionDetailInsights
              score={presentation.score}
              summaryLine={presentation.summaryLine}
              coverageBars={presentation.coverageBars}
              atsFlags={presentation.atsFlags}
              suggestions={presentation.suggestions}
            />
          </div>
          <div className={mobileTab === 'document' ? 'block' : 'hidden lg:block'}>
            <VaultVersionDetailDocumentPanel
              version={version}
              filename={presentation.filename}
              fileSizeLabel={fileSizeLabel}
              lastAnalyzedLabel={presentation.lastAnalyzedLabel}
              reanalyzing={reanalyzing}
              pendingRestore={pendingRestore}
              pendingActive={pendingActive}
              showSetActive={Boolean(entry && !entry.is_active)}
              showRestore={!presentation.isCurrentHead}
              onReanalyze={() => void handleReanalyze()}
              onRestore={() => void handleRestore()}
              onSetActive={() => void handleSetActive()}
              onDownload={version.has_source_file ? handleDownload : undefined}
              onBlobReady={handleBlobReady}
              onFileSize={handleFileSize}
            />
          </div>
        </div>
      )}
    </div>
  );
}
