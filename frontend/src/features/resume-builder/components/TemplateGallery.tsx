import { useState } from 'react';
import { Eye, Lock } from 'lucide-react';

import type { TemplateMetadata } from '../types/resumeBuilder';
import { getTemplateLabel } from '../utils/draftNames';

import TemplatePreviewModal from './TemplatePreviewModal';

type TemplateGalleryProps = {
  templates: TemplateMetadata[];
  selectedTemplateId: string;
  previewUrls?: Record<string, string>;
  catalogLoading?: boolean;
  previewsLoading?: boolean;
  variant?: 'landing' | 'workspace';
  onSelect: (templateId: string) => void;
};

type TemplatePreviewThumbProps = {
  previewUrl?: string;
  label: string;
  previewPending?: boolean;
  onExpand: () => void;
};

function TemplatePreviewThumb({ previewUrl, label, previewPending = false, onExpand }: TemplatePreviewThumbProps) {
  return (
    <div className="group/preview relative h-[132px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-0)]/70">
      {previewUrl ? (
        <>
          <img
            src={previewUrl}
            alt={`${label} template preview`}
            loading="lazy"
            decoding="async"
            className="h-full w-full scale-[1.02] object-cover object-top"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--bg-0)] via-[var(--bg-0)]/70 to-transparent" />
        </>
      ) : previewPending ? (
        <div className="app-shimmer h-full w-full" aria-hidden />
      ) : (
        <div className="flex h-full items-center justify-center text-[11px] text-[var(--color-on-surface-variant)]">
          No preview
        </div>
      )}

      {previewUrl ? (
        <button
          type="button"
          aria-label={`View full ${label} template preview`}
          onClick={(event) => {
            event.stopPropagation();
            onExpand();
          }}
          className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--color-surface-container)]/92 text-[var(--color-on-surface)] shadow-[0_8px_18px_rgba(2,6,23,0.22)] transition-[transform,background-color,border-color] duration-150 hover:scale-105 hover:border-[var(--color-primary)]/35 hover:bg-[var(--bg-0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export default function TemplateGallery({
  templates,
  selectedTemplateId,
  previewUrls = {},
  catalogLoading = false,
  previewsLoading = false,
  variant = 'landing',
  onSelect,
}: TemplateGalleryProps) {
  const placeholderCount =
    variant === 'workspace'
      ? 0
      : templates.some((template) => template.status === 'live')
        ? Math.min(2, Math.max(0, 3 - templates.length))
        : Math.min(3, Math.max(0, 4 - templates.length));
  const [expandedPreview, setExpandedPreview] = useState<{
    templateName: string;
    previewUrl: string;
  } | null>(null);

  if (catalogLoading && templates.length === 0) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={`catalog-skeleton-${index}`}
            className="flex min-w-[220px] max-w-[248px] shrink-0 flex-col gap-2.5 rounded-xl border border-[var(--border-subtle)] p-3"
          >
            <div className="app-shimmer h-3 w-24 rounded-md" aria-hidden />
            <div className="app-shimmer h-[132px] w-full rounded-xl" aria-hidden />
            <div className="app-shimmer h-3 w-full rounded-md" aria-hidden />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3">
          {templates.map((template) => {
            const selected = template.id === selectedTemplateId;
            const live = template.status === 'live';
            const previewUrl = previewUrls[template.id];
            const label = getTemplateLabel(template);

            return (
              <div
                key={template.id}
                role="button"
                tabIndex={live ? 0 : -1}
                aria-pressed={selected}
                aria-disabled={!live}
                onClick={() => live && onSelect(template.id)}
                onKeyDown={(event) => {
                  if (!live) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(template.id);
                  }
                }}
                className={[
                  'group flex min-w-[220px] max-w-[248px] shrink-0 flex-col gap-2.5 rounded-xl border p-3 text-left transition-all duration-200',
                  selected
                    ? 'border-[var(--color-primary)] bg-[var(--color-surface-container)]/90 shadow-[0_0_0_1px_var(--color-primary),0_12px_28px_rgba(2,6,23,0.18)]'
                    : 'border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/78',
                  live ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--color-primary)]' : 'cursor-not-allowed opacity-80',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                ].join(' ')}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="text-[11px] font-medium leading-snug text-[var(--color-on-surface-variant)]">
                    {template.tags.length > 0 ? template.tags.join(' · ') : label}
                  </p>

                  {!live ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-0)]/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
                      <Lock className="h-3 w-3" aria-hidden />
                      Soon
                    </span>
                  ) : null}
                </div>

                <TemplatePreviewThumb
                  previewUrl={previewUrl}
                  label={label}
                  previewPending={previewsLoading && !previewUrl && Boolean(template.preview_asset)}
                  onExpand={() => {
                    if (!previewUrl) return;
                    setExpandedPreview({ templateName: label, previewUrl });
                  }}
                />

                {template.description ? (
                  <p className="line-clamp-2 text-[11px] leading-snug text-[var(--color-on-surface-variant)]">
                    {template.description}
                  </p>
                ) : null}
              </div>
            );
          })}

          {Array.from({ length: placeholderCount }).map((_, index) => {
            const cardNumber = String(templates.length + index + 1).padStart(2, '0');
            return (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={`placeholder-${index}`}
                className="flex min-w-[220px] max-w-[248px] shrink-0 flex-col gap-2.5 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-0)]/36 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
                    Template {cardNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-0)]/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
                    <Lock className="h-3 w-3" aria-hidden />
                    Soon
                  </span>
                </div>

                <div className="h-[132px] rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-0)]/55 p-2">
                  <div className="grid h-full grid-cols-2 gap-2 opacity-60">
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-1)]/70" />
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-1)]/70" />
                  </div>
                </div>

                <p className="text-[11px] leading-snug text-[var(--color-on-surface-variant)]">
                  More layouts coming soon.
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <TemplatePreviewModal
        open={Boolean(expandedPreview)}
        templateName={expandedPreview?.templateName || 'Template'}
        previewUrl={expandedPreview?.previewUrl || null}
        onClose={() => setExpandedPreview(null)}
      />
    </>
  );
}
