import type { ResumeWorkExperienceItem } from 'features/vault/types/domain';

import { fieldLabelClass, fieldTextClass, inputClass, secondaryButtonClass, textareaClass } from './formStyles';

function linesFromTextarea(value: string): string[] {
  return value.split('\n').filter((line) => line.trim().length > 0);
}

type WorkExperienceSectionFormProps = {
  items: ResumeWorkExperienceItem[];
  visibleFields: string[];
  onAdd: () => void;
  onChange: (index: number, item: ResumeWorkExperienceItem) => void;
  onRemove: (index: number) => void;
};

export default function WorkExperienceSectionForm({
  items,
  visibleFields,
  onAdd,
  onChange,
  onRemove,
}: WorkExperienceSectionFormProps) {
  const show = (field: string) => visibleFields.includes(field);

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--cream-3)]">
          Add experience entries to fill this section.
        </p>
      ) : null}

      {items.map((item, index) => (
        <section key={`experience-${index}`} className="space-y-4 rounded-lg border border-[var(--border-subtle)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {show('title') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Role title</span>
                <input
                  name={`builder-work-title-${index}`}
                  value={item.title || ''}
                  onChange={(event) => onChange(index, { ...item, title: event.target.value })}
                  className={inputClass}
                  placeholder="Senior Software Engineer…"
                />
              </label>
            ) : null}
            {show('company') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Company</span>
                <input
                  name={`builder-work-company-${index}`}
                  value={item.company || ''}
                  onChange={(event) => onChange(index, { ...item, company: event.target.value })}
                  className={inputClass}
                  placeholder="Vetta.ai…"
                />
              </label>
            ) : null}
            {show('location') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Location</span>
                <input
                  name={`builder-work-location-${index}`}
                  value={item.location || ''}
                  onChange={(event) => onChange(index, { ...item, location: event.target.value })}
                  className={inputClass}
                  placeholder="Remote…"
                />
              </label>
            ) : null}
            {show('employment_type') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Employment type</span>
                <input
                  name={`builder-work-employment-${index}`}
                  value={item.employment_type || ''}
                  onChange={(event) => onChange(index, { ...item, employment_type: event.target.value })}
                  className={inputClass}
                  placeholder="full_time…"
                />
              </label>
            ) : null}
            {show('start_date') || show('end_date') ? (
              <div className="grid gap-4 md:grid-cols-2">
                {show('start_date') ? (
                  <label className={fieldLabelClass}>
                    <span className={fieldTextClass}>Start date</span>
                    <input
                      name={`builder-work-start-${index}`}
                      value={item.start_date || ''}
                      onChange={(event) => onChange(index, { ...item, start_date: event.target.value })}
                      className={inputClass}
                      placeholder="Jan 2024…"
                    />
                  </label>
                ) : null}
                {show('end_date') ? (
                  <label className={fieldLabelClass}>
                    <span className={fieldTextClass}>End date</span>
                    <input
                      name={`builder-work-end-${index}`}
                      value={item.end_date || ''}
                      onChange={(event) => onChange(index, { ...item, end_date: event.target.value })}
                      className={inputClass}
                      placeholder="Present…"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>

          {show('responsibilities') ? (
            <label className={fieldLabelClass}>
              <span className={fieldTextClass}>Responsibilities</span>
              <textarea
                name={`builder-work-responsibilities-${index}`}
                rows={5}
                value={(item.responsibilities || []).join('\n')}
                onChange={(event) =>
                  onChange(index, {
                    ...item,
                    responsibilities: linesFromTextarea(event.target.value),
                  })
                }
                className={textareaClass}
                placeholder="Add one bullet per line…"
              />
            </label>
          ) : null}

          {show('impact') ? (
            <label className={fieldLabelClass}>
              <span className={fieldTextClass}>Impact highlights</span>
              <textarea
                name={`builder-work-impact-${index}`}
                rows={3}
                value={(item.impact || []).join('\n')}
                onChange={(event) =>
                  onChange(index, {
                    ...item,
                    impact: linesFromTextarea(event.target.value),
                  })
                }
                className={textareaClass}
                placeholder="Quantified wins or outcomes…"
              />
            </label>
          ) : null}

          {show('tech_stack') ? (
            <label className={fieldLabelClass}>
              <span className={fieldTextClass}>Tech stack</span>
              <input
                name={`builder-work-stack-${index}`}
                value={(item.tech_stack || []).join(', ')}
                onChange={(event) =>
                  onChange(index, {
                    ...item,
                    tech_stack: event.target.value.split(',').map((token) => token.trim()).filter(Boolean),
                  })
                }
                className={inputClass}
                placeholder="FastAPI, Redis, React…"
              />
            </label>
          ) : null}

          <div className="flex justify-end">
            <button type="button" onClick={() => onRemove(index)} className={secondaryButtonClass}>
              Remove Entry
            </button>
          </div>
        </section>
      ))}

      <button type="button" onClick={onAdd} className={secondaryButtonClass}>
        Add Experience Entry
      </button>
    </div>
  );
}
