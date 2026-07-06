import { useState } from 'react';
import { Eye, FileCode2, FileText } from 'lucide-react';

interface PreviewPanelProps {
  previewUrl: string | null;
  previewing: boolean;
  pageCount: number;
  latex: string;
  latexLoading: boolean;
}

export default function PreviewPanel({
  previewUrl,
  previewing,
  pageCount,
  latex,
  latexLoading,
}: PreviewPanelProps) {
  const [activeView, setActiveView] = useState<'preview' | 'latex'>('preview');

  const statusLabel =
    activeView === 'preview'
      ? previewing
        ? 'Generating PDF…'
        : pageCount > 0
          ? `${pageCount} page${pageCount === 1 ? '' : 's'} rendered`
          : 'Run Preview PDF to render'
      : latexLoading
        ? 'Loading source…'
        : latex
          ? 'Generated from your draft'
          : 'Load LaTeX from the toolbar';

  return (
    <section className="rb-preview-panel">
      <div className="rb-panel__header">
        <div>
          <h2 className="rb-panel__title">Output</h2>
          <p className="rb-panel__subtitle" aria-live="polite">
            {statusLabel}
          </p>
        </div>

        <div className="rb-segmented" role="tablist" aria-label="Output view">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'preview'}
            onClick={() => setActiveView('preview')}
            className={['rb-segmented__btn', activeView === 'preview' ? 'rb-segmented__btn--active' : ''].join(' ')}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Preview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'latex'}
            onClick={() => setActiveView('latex')}
            className={['rb-segmented__btn', activeView === 'latex' ? 'rb-segmented__btn--active' : ''].join(' ')}
          >
            <FileCode2 className="h-3.5 w-3.5" aria-hidden />
            LaTeX
          </button>
        </div>
      </div>

      {activeView === 'preview' ? (
        previewUrl ? (
          <div className="rb-preview-stage">
            <div className="rb-preview-paper">
              <iframe title="Resume preview" src={previewUrl} />
            </div>
          </div>
        ) : (
          <div className="rb-preview-empty">
            <span className="rb-preview-empty__icon">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-semibold text-[var(--color-on-surface)]">No PDF preview yet</p>
            <p className="mt-1.5 max-w-xs text-sm text-[var(--color-on-surface-variant)]">
              Save your draft, then use Preview PDF in the toolbar to render the layout.
            </p>
          </div>
        )
      ) : latex ? (
        <pre className="rb-latex-block">{latex}</pre>
      ) : (
        <div className="rb-latex-empty">
          <span className="rb-latex-empty__icon">
            <FileCode2 className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-4 text-sm font-semibold text-[var(--color-on-surface)]">LaTeX source</p>
          <p className="mt-1.5 max-w-xs text-sm text-[var(--color-on-surface-variant)]">
            Use LaTeX in the toolbar to load the generated source for this draft.
          </p>
        </div>
      )}
    </section>
  );
}
