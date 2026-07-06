import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  VaultVersionDetailDocumentPanel,
  VaultVersionDetailInsights,
} from 'features/vault/components/version-detail';
import { VAULT_VERSION_DETAIL_COPY } from 'features/vault/constants/versionDetailContent';
import { useVersionDetailPage } from 'features/vault/hooks/useVersionDetailPage';
import { formatFileSize } from 'features/vault/utils/versionDetailPresentation';
import PageLoadingState from 'shared/components/PageLoadingState';

function DocumentPanelSkeleton() {
  return (
    <section className="vault-version-detail__document glass-panel space-y-4 p-5">
      <div className="space-y-2">
        <div className="app-shimmer h-5 w-48 rounded-md" aria-hidden />
        <div className="app-shimmer h-3 w-32 rounded-md" aria-hidden />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="app-shimmer h-9 w-28 rounded-lg" aria-hidden />
        <div className="app-shimmer h-9 w-28 rounded-lg" aria-hidden />
      </div>
      <div className="app-shimmer min-h-[50vh] w-full rounded-xl" aria-hidden />
    </section>
  );
}

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
    openInBuilder,
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

  const metadataReady = Boolean(version && presentation);

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

      <div className="vault-version-detail-page__layout">
        <div className={mobileTab === 'insights' ? 'block' : 'hidden lg:block'}>
          {loading || !metadataReady ? (
            <PageLoadingState variant="version-detail-insights" minHeightClassName="min-h-[24rem]" />
          ) : (
            <VaultVersionDetailInsights
              score={presentation.score}
              summaryLine={presentation.summaryLine}
              coverageBars={presentation.coverageBars}
              atsFlags={presentation.atsFlags}
              suggestions={presentation.suggestions}
            />
          )}
        </div>

        <div className={mobileTab === 'document' ? 'block' : 'hidden lg:block'}>
          {loading || !metadataReady || !version || !presentation ? (
            <DocumentPanelSkeleton />
          ) : (
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
              onOpenInBuilder={openInBuilder}
              onDownload={version.has_source_file ? handleDownload : undefined}
              onBlobReady={handleBlobReady}
              onFileSize={handleFileSize}
            />
          )}
        </div>
      </div>
    </div>
  );
}
