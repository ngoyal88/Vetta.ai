import type { ResumePublicationItem } from 'features/vault/types/domain';

import { fieldLabelClass, fieldTextClass, inputClass, secondaryButtonClass } from './formStyles';

type PublicationsSectionFormProps = {
  items: ResumePublicationItem[];
  onAdd: () => void;
  onChange: (index: number, item: ResumePublicationItem) => void;
  onRemove: (index: number) => void;
};

export default function PublicationsSectionForm({ items, onAdd, onChange, onRemove }: PublicationsSectionFormProps) {
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--cream-3)]">
          Add publications, papers, or research output.
        </p>
      ) : null}

      {items.map((item, index) => (
        <section key={`publication-${index}`} className="grid gap-4 rounded-lg border border-[var(--border-subtle)] p-4 md:grid-cols-2">
          <label className={`${fieldLabelClass} md:col-span-2`}>
            <span className={fieldTextClass}>Title</span>
            <input
              name={`builder-publication-title-${index}`}
              value={item.title || ''}
              onChange={(event) => onChange(index, { ...item, title: event.target.value })}
              className={inputClass}
              placeholder="Typed Requirement Alignment…"
            />
          </label>
          <label className={fieldLabelClass}>
            <span className={fieldTextClass}>Venue</span>
            <input
              name={`builder-publication-venue-${index}`}
              value={item.venue || ''}
              onChange={(event) => onChange(index, { ...item, venue: event.target.value })}
              className={inputClass}
              placeholder="ACM…"
            />
          </label>
          <label className={fieldLabelClass}>
            <span className={fieldTextClass}>Year</span>
            <input
              name={`builder-publication-year-${index}`}
              value={item.year || ''}
              onChange={(event) => onChange(index, { ...item, year: event.target.value })}
              className={inputClass}
              placeholder="2026…"
            />
          </label>
          <label className={`${fieldLabelClass} md:col-span-2`}>
            <span className={fieldTextClass}>Link</span>
            <input
              name={`builder-publication-link-${index}`}
              type="url"
              autoComplete="url"
              spellCheck={false}
              value={item.link || ''}
              onChange={(event) => onChange(index, { ...item, link: event.target.value })}
              className={inputClass}
              placeholder="https://doi.org/…"
            />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button type="button" onClick={() => onRemove(index)} className={secondaryButtonClass}>
              Remove Publication
            </button>
          </div>
        </section>
      ))}

      <button type="button" onClick={onAdd} className={secondaryButtonClass}>
        Add Publication
      </button>
    </div>
  );
}

