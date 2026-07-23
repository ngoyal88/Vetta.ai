import '../resume-builder.css';
import BuilderToolbar from '../components/BuilderToolbar';
import PreviewPanel from '../components/PreviewPanel';
import PublishModal from '../components/PublishModal';
import SectionAccordion from '../components/SectionAccordion';
import SaveDraftModal from '../components/SaveDraftModal';
import BuilderLandingView from '../components/landing/BuilderLandingView';
import PageLoadingState from 'shared/components/PageLoadingState';
import { useVaultLibraryContext } from 'features/vault/context/VaultLibraryContext';
import { useBuilderLanding } from '../hooks/useBuilderLanding';
import { useResumeBuilder } from '../hooks/useResumeBuilder';
import { getDraftDisplayName, getTemplateLabel, resolveTemplateLabel } from '../utils/draftNames';
import { useEffect, useState } from 'react';

type EditorTab = 'sections' | 'readiness' | 'template';

export default function ResumeBuilderPage() {
  const landing = useBuilderLanding();
  const builder = useResumeBuilder();
  const { entries } = useVaultLibraryContext();
  const [requestedEditorTab, setRequestedEditorTab] = useState<EditorTab | null>(null);
  const [showTemplateHint, setShowTemplateHint] = useState(false);

  const showWorkspace = Boolean(builder.draft) || builder.workspaceLoading;

  useEffect(() => {
    if (!showWorkspace || typeof window === 'undefined') return;
    if (window.sessionStorage.getItem('builder_show_template_hint') === '1') {
      window.sessionStorage.removeItem('builder_show_template_hint');
      if (window.sessionStorage.getItem('builder_template_hint_dismissed') !== '1') {
        setShowTemplateHint(true);
      }
    }
  }, [showWorkspace]);

  if (!builder.builderEnabled && !builder.catalogLoading && !landing.catalogLoading) {
    return (
      <section className="glass-panel rounded-[1.5rem] border border-[var(--border-subtle)] p-6 shadow-[0_18px_48px_rgba(2,6,23,0.18)]">
        <p className="type-label-sm uppercase tracking-[0.18em] text-[var(--color-primary)]">Resume Vault</p>
        <h1 className="type-headline-md mt-2 text-[var(--color-on-surface)]">Resume Builder is currently disabled.</h1>
        <p className="type-body-md mt-2 max-w-2xl text-[var(--color-on-surface-variant)]">
          The Builder route is available in the app shell, but the feature flag is currently turned off for this environment.
        </p>
      </section>
    );
  }

  if ((builder.error || landing.error) && !showWorkspace && !landing.catalogLoading) {
    return (
      <section className="glass-panel rounded-[1.5rem] border border-[var(--color-error)]/20 bg-[var(--color-error)]/8 p-6 shadow-[0_18px_48px_rgba(2,6,23,0.18)]">
        <p className="type-label-sm uppercase tracking-[0.18em] text-[var(--color-error)]">Resume Builder Error</p>
        <h1 className="type-headline-md mt-2 text-[var(--color-on-surface)]">We could not load the builder workspace.</h1>
        <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">{builder.error || landing.error}</p>
      </section>
    );
  }

  if (!showWorkspace) {
    return <BuilderLandingView landing={landing} vaultEntryCount={entries.length} />;
  }

  const templateLabel = builder.activeTemplate
    ? getTemplateLabel(builder.activeTemplate)
    : builder.draft
      ? resolveTemplateLabel(builder.draft.template_id, builder.templates)
      : null;

  return (
    <div className="rb-workspace space-y-6">
      <p className="sr-only" aria-live="polite">{builder.statusMessage}</p>

      <BuilderToolbar
        draftName={builder.draft ? getDraftDisplayName(builder.draft) : 'Loading draft…'}
        templateLabel={templateLabel}
        busy={builder.workspaceLoading}
        saving={builder.saving}
        previewing={builder.previewing}
        publishing={builder.publishing}
        saveState={builder.saveState}
        readinessStatus={builder.readiness.status}
        readinessBlockingCount={builder.readiness.blocking.length}
        readinessWarningCount={builder.readiness.warnings.length}
        readinessInfoCount={builder.readiness.info.length}
        readinessStrengthCount={builder.readiness.strengths.length}
        pageCount={builder.pageCount}
        canUndo={builder.canUndo}
        canRedo={builder.canRedo}
        onUndo={builder.undoDraft}
        onRedo={builder.redoDraft}
        onSaveDraft={builder.openSaveDraftModal}
        onRefreshPreview={builder.refreshPreview}
        onRefreshLatex={builder.refreshLatex}
        onOpenPublish={builder.openPublishModal}
        onDeleteDraft={builder.deleteCurrentDraft}
        onOpenTemplateTab={() => setRequestedEditorTab('template')}
      />

      {showTemplateHint ? (
        <section className="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/8 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="type-body-md text-[var(--color-on-surface)]">
              Add content, then open the <strong>Template</strong> tab to compare layouts.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowTemplateHint(false);
                if (typeof window !== 'undefined') {
                  window.sessionStorage.setItem('builder_template_hint_dismissed', '1');
                }
              }}
              className="type-label-sm font-semibold text-[var(--color-primary)]"
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {builder.previewStale ? (
        <section className="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/8 px-4 py-3">
          <p className="type-body-md text-[var(--color-on-surface)]">
            Template changed — refresh preview to see updates.
          </p>
        </section>
      ) : null}

      {builder.error && !builder.workspaceLoading ? (
        <section className="rounded-xl border border-[var(--color-error)]/25 bg-[var(--color-error)]/8 px-4 py-3">
          <p className="type-body-md text-[var(--color-error)]">{builder.error}</p>
        </section>
      ) : null}

      {builder.workspaceLoading || !builder.draft ? (
        <PageLoadingState variant="builder-workspace" minHeightClassName="py-4" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr),minmax(0,0.95fr)]">
          <SectionAccordion
            builder={builder}
            requestedTab={requestedEditorTab}
            onTabRequestConsumed={() => setRequestedEditorTab(null)}
          />

          <div className="xl:sticky xl:top-6 xl:self-start">
            <PreviewPanel
              previewUrl={builder.previewUrl}
              previewing={builder.previewing}
              pageCount={builder.pageCount}
              latex={builder.latex}
              latexLoading={builder.latexLoading}
            />
          </div>
        </div>
      )}

      <SaveDraftModal
        open={builder.saveDraftOpen}
        saving={builder.saving}
        defaultName={builder.saveDraftName}
        onClose={builder.closeSaveDraftModal}
        onSubmit={builder.confirmSaveDraft}
      />

      <PublishModal
        open={builder.publishOpen}
        publishing={builder.publishing}
        hasExistingTarget={builder.hasExistingPublishTarget}
        publishMode={builder.publishMode}
        resumeName={builder.publishResumeName}
        userNote={builder.publishUserNote}
        tags={builder.publishTags}
        setActive={builder.publishSetActive}
        readiness={builder.readiness}
        canPublish={builder.canPublish}
        onClose={builder.closePublishModal}
        onPublishModeChange={builder.setPublishMode}
        onResumeNameChange={builder.setPublishResumeName}
        onUserNoteChange={builder.setPublishUserNote}
        onTagsChange={builder.setPublishTags}
        onSetActiveChange={builder.setPublishSetActive}
        onSubmit={() => {
          void builder.publishCurrentDraft();
        }}
      />
    </div>
  );
}
