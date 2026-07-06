import type { ResumeEducationRecord } from 'features/vault/types/domain';

import { fieldLabelClass, fieldTextClass, inputClass, secondaryButtonClass, textareaClass } from './formStyles';

type EducationSectionFormProps = {
  items: ResumeEducationRecord[];
  visibleFields: string[];
  onAdd: () => void;
  onChange: (index: number, item: ResumeEducationRecord) => void;
  onRemove: (index: number) => void;
  onAddHighlight: (educationIndex: number) => void;
  onHighlightChange: (educationIndex: number, highlightIndex: number, label: string, text: string) => void;
  onRemoveHighlight: (educationIndex: number, highlightIndex: number) => void;
};

export default function EducationSectionForm({
  items,
  visibleFields,
  onAdd,
  onChange,
  onRemove,
  onAddHighlight,
  onHighlightChange,
  onRemoveHighlight,
}: EducationSectionFormProps) {
  const show = (field: string) => visibleFields.includes(field);

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--cream-3)]">
          Add education entries to show your academic background.
        </p>
      ) : null}

      {items.map((item, index) => (
        <section key={`education-${index}`} className="space-y-4 rounded-lg border border-[var(--border-subtle)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {show('degree') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Degree</span>
                <input
                  name={`builder-education-degree-${index}`}
                  value={item.degree || ''}
                  onChange={(event) => onChange(index, { ...item, degree: event.target.value })}
                  className={inputClass}
                  placeholder="Bachelor of Engineering…"
                />
              </label>
            ) : null}
            {show('field') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Field</span>
                <input
                  name={`builder-education-field-${index}`}
                  value={item.field || ''}
                  onChange={(event) => onChange(index, { ...item, field: event.target.value })}
                  className={inputClass}
                  placeholder="Computer Science…"
                />
              </label>
            ) : null}
            {show('minor') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Minor</span>
                <input
                  name={`builder-education-minor-${index}`}
                  value={item.minor || ''}
                  onChange={(event) => onChange(index, { ...item, minor: event.target.value })}
                  className={inputClass}
                  placeholder="Mathematics…"
                />
              </label>
            ) : null}
            {show('institution') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Institution</span>
                <input
                  name={`builder-education-institution-${index}`}
                  value={item.institution || ''}
                  onChange={(event) => onChange(index, { ...item, institution: event.target.value })}
                  className={inputClass}
                  placeholder="Thapar Institute…"
                />
              </label>
            ) : null}
            {show('location') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Location</span>
                <input
                  name={`builder-education-location-${index}`}
                  value={item.location || ''}
                  onChange={(event) => onChange(index, { ...item, location: event.target.value })}
                  className={inputClass}
                  placeholder="Patiala…"
                />
              </label>
            ) : null}
            {show('start_date') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Start date</span>
                <input
                  name={`builder-education-start-${index}`}
                  value={item.start_date || ''}
                  onChange={(event) => onChange(index, { ...item, start_date: event.target.value })}
                  className={inputClass}
                  placeholder="2022…"
                />
              </label>
            ) : null}
            {show('end_date') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>End date</span>
                <input
                  name={`builder-education-end-${index}`}
                  value={item.end_date || ''}
                  onChange={(event) => onChange(index, { ...item, end_date: event.target.value })}
                  className={inputClass}
                  placeholder="2026…"
                />
              </label>
            ) : null}
            {show('cgpa') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>CGPA / GPA</span>
                <input
                  name={`builder-education-cgpa-${index}`}
                  value={item.cgpa || ''}
                  onChange={(event) => onChange(index, { ...item, cgpa: event.target.value })}
                  className={inputClass}
                  placeholder="8.8 / 10…"
                />
              </label>
            ) : null}
          </div>

          {show('highlights') ? (
            <div className="space-y-3">
              <p className={fieldTextClass}>Highlights (coursework, research, honors)</p>
              {(item.highlights || []).map((highlight, highlightIndex) => (
                <div
                  key={`education-${index}-highlight-${highlightIndex}`}
                  className="grid gap-3 rounded-lg border border-[var(--border-subtle)]/80 p-3 md:grid-cols-[minmax(0,10rem)_1fr_auto]"
                >
                  <label className={fieldLabelClass}>
                    <span className={fieldTextClass}>Label</span>
                    <input
                      name={`builder-education-highlight-label-${index}-${highlightIndex}`}
                      value={highlight.label}
                      onChange={(event) =>
                        onHighlightChange(index, highlightIndex, event.target.value, highlight.text)
                      }
                      className={inputClass}
                      placeholder="Coursework…"
                    />
                  </label>
                  <label className={fieldLabelClass}>
                    <span className={fieldTextClass}>Details</span>
                    <textarea
                      name={`builder-education-highlight-text-${index}-${highlightIndex}`}
                      rows={2}
                      value={highlight.text}
                      onChange={(event) =>
                        onHighlightChange(index, highlightIndex, highlight.label, event.target.value)
                      }
                      className={textareaClass}
                      placeholder="Data Structures, Algorithms…"
                    />
                  </label>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => onRemoveHighlight(index, highlightIndex)}
                      className={secondaryButtonClass}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => onAddHighlight(index)} className={secondaryButtonClass}>
                Add Highlight
              </button>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button type="button" onClick={() => onRemove(index)} className={secondaryButtonClass}>
              Remove Entry
            </button>
          </div>
        </section>
      ))}

      <button type="button" onClick={onAdd} className={secondaryButtonClass}>
        Add Education Entry
      </button>
    </div>
  );
}
