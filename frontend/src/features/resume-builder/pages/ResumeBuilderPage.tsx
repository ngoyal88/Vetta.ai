import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../resume-builder.css';
import BuilderToolbar from '../components/BuilderToolbar';
import NavigationBlockModal from '../components/NavigationBlockModal';
import PreviewPanel from '../components/PreviewPanel';
import PublishModal from '../components/PublishModal';
import SectionAccordion from '../components/SectionAccordion';
import SaveDraftModal from '../components/SaveDraftModal';
import TemplateGallery from '../components/TemplateGallery';
import PageLoadingState from 'shared/components/PageLoadingState';
import { useResumeBuilder } from '../hooks/useResumeBuilder';
import { getDraftDisplayName, getTemplateLabel, resolveTemplateLabel } from '../utils/draftNames';

function formatDraftTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently updated';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function BuilderLandingHeader({
  profileReady,
  saving,
  catalogLoading,
  focusRingClass,
  onCreateDraft,
}: {
  profileReady: boolean;
  saving: boolean;
  catalogLoading: boolean;
  focusRingClass: string;
  onCreateDraft: () => void;
}) {
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl min-w-0">
        <p className="type-label-sm uppercase tracking-[0.24em] text-[var(--color-secondary)]">
          Resume Vault / Builder
        </p>
        <h1 className="type-display-lg mt-2 text-[var(--color-on-surface)]">Resume Builder</h1>
        <p className="type-body-lg mt-4 text-[var(--color-on-surface-variant)]">
          Pick a layout, create a draft, and publish to Vault when it is ready.
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-3">
        {!profileReady ? (
          <Link
            to="/profile"
            className={`inline-flex items-center rounded-xl border border-[var(--border-strong)] px-4 py-3 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-container)] ${focusRingClass}`}
          >
            Complete profile
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => void onCreateDraft()}
          disabled={saving || !profileReady || catalogLoading}
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
        >
          {saving ? 'Creating…' : 'Create New Resume'}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}

export default function ResumeBuilderPage() {
  const builder = useResumeBuilder();
  const showWorkspace = Boolean(builder.draft) || builder.workspaceLoading;

  if (!builder.builderEnabled && !builder.catalogLoading) {
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

  if (builder.error && !builder.catalogLoading && !builder.workspaceLoading && !builder.draft) {
    return (
      <section className="glass-panel rounded-[1.5rem] border border-[var(--color-error)]/20 bg-[var(--color-error)]/8 p-6 shadow-[0_18px_48px_rgba(2,6,23,0.18)]">
        <p className="type-label-sm uppercase tracking-[0.18em] text-[var(--color-error)]">Resume Builder Error</p>
        <h1 className="type-headline-md mt-2 text-[var(--color-on-surface)]">We could not load the builder workspace.</h1>
        <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">{builder.error}</p>
      </section>
    );
  }

  if (!showWorkspace) {
    return (
      <div className="space-y-10">
        <p className="sr-only" aria-live="polite">{builder.statusMessage}</p>

        <BuilderLandingHeader
          profileReady={builder.profileReady}
          saving={builder.saving}
          catalogLoading={builder.catalogLoading}
          focusRingClass={builder.focusRingClass}
          onCreateDraft={builder.createDraft}
        />

        {!builder.profileReady ? (
          <p className="type-body-md text-[var(--color-on-surface-variant)]">
            Add your name in Profile before creating a draft.
          </p>
        ) : null}

        <TemplateGallery
          templates={builder.templates}
          selectedTemplateId={builder.selectedTemplateId}
          previewUrls={builder.templatePreviewUrls}
          catalogLoading={builder.catalogLoading}
          previewsLoading={builder.previewsLoading}
          onSelect={builder.setSelectedTemplateId}
        />

        <section>
          <h2 className="type-headline-md mb-3 text-[var(--color-on-surface)]">Saved drafts</h2>
          {builder.catalogLoading ? (
            <PageLoadingState variant="list" minHeightClassName="py-2" />
          ) : builder.savedDrafts.length ? (
            <ul className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {builder.savedDrafts.map((savedDraft) => (
                <li key={savedDraft.id}>
                  <button
                    type="button"
                    onClick={() => builder.openDraft(savedDraft.id)}
                    className={`flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:bg-[var(--color-surface-container)]/40 ${builder.focusRingClass}`}
                  >
                    <div className="min-w-0">
                      <p className="type-body-md truncate font-semibold text-[var(--color-on-surface)]">
                        {getDraftDisplayName(savedDraft)}
                      </p>
                      <p className="type-label-sm mt-0.5 text-[var(--color-on-surface-variant)]">
                        {resolveTemplateLabel(savedDraft.template_id, builder.templates)}
                        {' · '}
                        Updated {formatDraftTimestamp(savedDraft.updated_at)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-on-surface-variant)]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body-md text-[var(--color-on-surface-variant)]">No saved drafts yet.</p>
          )}
        </section>
      </div>
    );
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
      />

      {builder.error && !builder.workspaceLoading ? (
        <section className="rounded-xl border border-[var(--color-error)]/25 bg-[var(--color-error)]/8 px-4 py-3">
          <p className="type-body-md text-[var(--color-error)]">{builder.error}</p>
        </section>
      ) : null}

      {builder.workspaceLoading || !builder.draft ? (
        <PageLoadingState variant="builder-workspace" minHeightClassName="py-4" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr),minmax(0,0.95fr)]">
          <SectionAccordion builder={builder} />

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

      <NavigationBlockModal
        open={builder.navigationBlockOpen}
        onStay={builder.stayOnBuilder}
        onLeave={builder.leaveBuilder}
      />
    </div>
  );
}
