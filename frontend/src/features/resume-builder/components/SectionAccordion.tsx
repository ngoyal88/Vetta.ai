import { useEffect, useRef, useState } from 'react';
import { ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react';

import type { useResumeBuilder } from '../hooks/useResumeBuilder';
import { getSectionIcon } from '../utils/sectionIcons';

import { SectionFormContent } from './SectionFormContent';

type SectionAccordionProps = {
  builder: ReturnType<typeof useResumeBuilder>;
};

export default function SectionAccordion({ builder }: SectionAccordionProps) {
  const draft = builder.draft;
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditingSectionId(null);
    setDraftLabel('');
  }, [builder.selectedSectionId]);

  useEffect(() => {
    if (!addMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [addMenuOpen]);

  if (!draft) return null;

  const visibleSections = draft.section_layout.filter((section) => section.kind === 'identity' || section.enabled);
  const hiddenSections = draft.section_layout.filter((section) => section.kind !== 'identity' && !section.enabled);

  const beginEditing = (sectionId: string, label: string) => {
    setEditingSectionId(sectionId);
    setDraftLabel(label);
  };

  const commitEditing = (sectionId: string, currentLabel: string) => {
    const nextLabel = draftLabel.trim();
    if (nextLabel && nextLabel !== currentLabel) {
      builder.renameSection(sectionId, nextLabel);
    }
    setEditingSectionId(null);
    setDraftLabel('');
  };

  return (
    <section className="rb-panel">
      <div className="rb-panel__header">
        <div>
          <h2 className="rb-panel__title">Sections</h2>
          <p className="rb-panel__subtitle">
            {visibleSections.length} active
            {hiddenSections.length ? ` · ${hiddenSections.length} hidden` : ''}
            {' · '}
            Click a name to rename
          </p>
        </div>
        <div className="relative shrink-0" ref={addMenuRef}>
          <button
            type="button"
            onClick={() => setAddMenuOpen((open) => !open)}
            aria-expanded={addMenuOpen}
            aria-haspopup="menu"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-0)]/60 px-3 py-2 text-xs font-semibold text-[var(--color-on-surface)] transition-colors hover:border-[var(--color-primary)]/35 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add section
          </button>
          {addMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 min-w-[12rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-0)] p-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  builder.addCustomSection();
                  setAddMenuOpen(false);
                }}
                className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
              >
                Custom section
              </button>
              {hiddenSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    builder.enableSection(section.id);
                    setAddMenuOpen(false);
                  }}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                >
                  {section.label || section.kind}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <ul className="rb-section-list">
        {visibleSections.map((section) => {
          const isIdentity = section.kind === 'identity';
          const expanded = builder.selectedSectionId === section.id;
          const isEditing = editingSectionId === section.id;
          const SectionIcon = getSectionIcon(section.kind);

          return (
            <li
              key={section.id}
              className={[
                'rb-section-card',
                draggedSectionId === section.id ? 'opacity-40' : '',
                expanded ? 'rb-section-card--expanded' : '',
              ].join(' ')}
              onDragOver={(event) => {
                if (!draggedSectionId || draggedSectionId === section.id || isIdentity) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggedSectionId || draggedSectionId === section.id || isIdentity) return;
                builder.reorderSection(draggedSectionId, section.id);
                setDraggedSectionId(null);
              }}
            >
              <div className="flex items-center gap-1.5 px-2 py-2">
                <button
                  type="button"
                  draggable={!isIdentity}
                  disabled={isIdentity}
                  aria-label={`Reorder ${section.label}`}
                  onDragStart={() => setDraggedSectionId(section.id)}
                  onDragEnd={() => setDraggedSectionId(null)}
                  className="inline-flex h-8 w-7 shrink-0 cursor-grab items-center justify-center text-[var(--color-on-surface-variant)] active:cursor-grabbing disabled:cursor-default disabled:opacity-25"
                >
                  <GripVertical className="h-4 w-4" aria-hidden />
                </button>

                <span className="rb-section-icon" aria-hidden>
                  <SectionIcon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draftLabel}
                      onChange={(event) => setDraftLabel(event.target.value)}
                      onBlur={() => commitEditing(section.id, section.label)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitEditing(section.id, section.label);
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setEditingSectionId(null);
                          setDraftLabel('');
                        }
                      }}
                      className="w-full rounded-lg border border-[var(--color-primary)]/28 bg-[var(--bg-0)] px-2.5 py-1.5 text-sm font-medium text-[var(--color-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    />
                  ) : isIdentity ? (
                    <span className="truncate text-sm font-semibold text-[var(--color-on-surface)]">
                      {section.label || section.kind}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginEditing(section.id, section.label || section.kind)}
                      className="truncate text-left text-sm font-semibold text-[var(--color-on-surface)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    >
                      {section.label || section.kind}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => builder.setSelectedSectionId(expanded ? null : section.id)}
                  aria-expanded={expanded}
                  aria-label={expanded ? `Collapse ${section.label}` : `Expand ${section.label}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  <ChevronDown
                    className={['h-4 w-4 transition-transform duration-200', expanded ? 'rotate-180' : ''].join(' ')}
                    aria-hidden
                  />
                </button>

                {!isIdentity ? (
                  <button
                    type="button"
                    onClick={() => builder.removeSection(section.id)}
                    aria-label={`Remove ${section.label}`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <span className="h-8 w-8 shrink-0" aria-hidden />
                )}
              </div>

              {expanded ? (
                <div className="rb-section-body">
                  <SectionFormContent
                    section={section}
                    profile={draft.profile}
                    customSections={draft.custom_sections}
                    builder={builder}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
