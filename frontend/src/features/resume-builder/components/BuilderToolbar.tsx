import { ArrowLeft, Eye, FileCode2, LayoutTemplate, Redo2, Save, Trash2, Undo2, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { SaveState } from '../hooks/draftAutosave';
import type { BuilderReadinessStatus } from '../utils/builderReadiness';

interface BuilderToolbarProps {
  draftName: string;
  templateLabel?: string | null;
  saving: boolean;
  previewing: boolean;
  publishing: boolean;
  saveState: SaveState;
  readinessStatus: BuilderReadinessStatus;
  readinessBlockingCount: number;
  readinessWarningCount: number;
  readinessInfoCount: number;
  readinessStrengthCount: number;
  pageCount: number;
  busy?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void | Promise<void>;
  onRedo: () => void | Promise<void>;
  onSaveDraft: () => void | Promise<void>;
  onRefreshPreview: () => void | Promise<void>;
  onRefreshLatex: () => void | Promise<void>;
  onOpenPublish: () => void | Promise<void>;
  onDeleteDraft: () => void | Promise<void>;
}

const actionButtonClass =
  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60';

const iconButtonClass =
  'inline-flex items-center justify-center rounded-lg p-2 text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60';

function saveStateLabel(saveState: SaveState): string {
  switch (saveState) {
    case 'synced':
      return 'All changes saved';
    case 'dirty':
      return 'Unsaved changes';
    case 'saving':
      return 'Saving…';
    case 'save_failed':
      return "Couldn't save";
    default:
      return 'All changes saved';
  }
}

function saveStateClass(saveState: SaveState): string {
  switch (saveState) {
    case 'dirty':
      return 'rb-status-pill--dirty';
    case 'saving':
      return 'rb-status-pill--saving';
    case 'save_failed':
      return 'rb-status-pill--failed';
    default:
      return '';
  }
}

function readinessLabel(status: BuilderReadinessStatus, blockingCount: number, warningCount: number, infoCount: number, strengthCount: number): string {
  if (status === 'blocked') return blockingCount === 1 ? 'Blocked · 1 issue' : `Blocked · ${blockingCount} issues`;
  if (status === 'needs_review') {
    const issueCount = warningCount + infoCount;
    if (strengthCount > 0) {
      return `Review · ${strengthCount} strength${strengthCount === 1 ? '' : 's'} · ${issueCount} item${issueCount === 1 ? '' : 's'}`;
    }
    return issueCount === 1 ? '1 item to review' : `${issueCount} items to review`;
  }
  return strengthCount > 0 ? `Ready · ${strengthCount} strength${strengthCount === 1 ? '' : 's'}` : 'Ready to publish';
}

function readinessClass(status: BuilderReadinessStatus): string {
  if (status === 'blocked') return 'rb-status-pill--failed';
  if (status === 'needs_review') return 'rb-status-pill--dirty';
  return 'rb-status-pill--saving';
}

export default function BuilderToolbar({
  draftName,
  templateLabel,
  saving,
  previewing,
  publishing,
  saveState,
  readinessStatus,
  readinessBlockingCount,
  readinessWarningCount,
  readinessInfoCount,
  readinessStrengthCount,
  pageCount,
  busy = false,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveDraft,
  onRefreshPreview,
  onRefreshLatex,
  onOpenPublish,
  onDeleteDraft,
}: BuilderToolbarProps) {
  const pageHint = pageCount > 0 ? `${pageCount} page preview` : null;
  const isSaving = saving || saveState === 'saving';

  return (
    <header className="rb-toolbar p-4 sm:p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <Link to="/resume-vault/builder" className="rb-toolbar__back focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All drafts
          </Link>

          <div className="min-w-0">
            <p className="type-label-sm uppercase tracking-[0.2em] text-[var(--color-secondary)]">{draftName}</p>
            <h1 className="type-headline-md mt-1 text-[var(--color-on-surface)]">Resume Builder</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={['rb-status-pill', saveStateClass(saveState)].filter(Boolean).join(' ')}>
              <span className="rb-status-pill__dot" aria-hidden />
              {saveStateLabel(saveState)}
            </span>
            <span className={['rb-status-pill', readinessClass(readinessStatus)].filter(Boolean).join(' ')}>
              <span className="rb-status-pill__dot" aria-hidden />
                {readinessLabel(
                  readinessStatus,
                  readinessBlockingCount,
                  readinessWarningCount,
                  readinessInfoCount,
                  readinessStrengthCount,
                )}
            </span>
            {templateLabel ? (
              <span className="rb-template-chip">
                <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
                {templateLabel}
              </span>
            ) : null}
            {pageHint ? (
              <span className="type-label-sm text-[var(--color-on-surface-variant)]">{pageHint}</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="rb-action-group">
            <button
              type="button"
              onClick={() => void onUndo()}
              disabled={busy || !canUndo}
              className={iconButtonClass}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" aria-hidden />
            </button>

            <button
              type="button"
              onClick={() => void onRedo()}
              disabled={busy || !canRedo}
              className={iconButtonClass}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" aria-hidden />
            </button>

            <button type="button" onClick={() => void onSaveDraft()} disabled={busy || isSaving} className={actionButtonClass}>
              <Save className="h-4 w-4" aria-hidden />
              {isSaving ? 'Saving…' : 'Save'}
            </button>

            <button type="button" onClick={() => void onRefreshPreview()} disabled={busy || previewing} className={actionButtonClass}>
              <Eye className="h-4 w-4" aria-hidden />
              {previewing ? 'Generating…' : 'Preview PDF'}
            </button>

            <button type="button" onClick={() => void onRefreshLatex()} disabled={busy} className={actionButtonClass}>
              <FileCode2 className="h-4 w-4" aria-hidden />
              LaTeX
            </button>

            <button
              type="button"
              onClick={() => void onOpenPublish()}
              disabled={busy || publishing}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" aria-hidden />
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void onDeleteDraft()}
            disabled={busy}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-[var(--color-error)]/30 px-3 py-1.5 text-xs font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)] disabled:cursor-not-allowed disabled:opacity-60 sm:self-end"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete draft
          </button>
        </div>
      </div>
    </header>
  );
}
