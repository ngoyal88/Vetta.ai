import type { ResumeProjectItem } from 'features/vault/types/domain';

import { fieldLabelClass, fieldTextClass, inputClass, secondaryButtonClass, textareaClass } from './formStyles';

type ProjectsSectionFormProps = {
  items: ResumeProjectItem[];
  visibleFields: string[];
  onAdd: () => void;
  onChange: (index: number, item: ResumeProjectItem) => void;
  onRemove: (index: number) => void;
};

export default function ProjectsSectionForm({
  items,
  visibleFields,
  onAdd,
  onChange,
  onRemove,
}: ProjectsSectionFormProps) {
  const show = (field: string) => visibleFields.includes(field);

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--cream-3)]">
          Add projects to show applied experience and portfolio work.
        </p>
      ) : null}

      {items.map((item, index) => (
        <section key={`project-${index}`} className="space-y-4 rounded-lg border border-[var(--border-subtle)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {show('name') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Project name</span>
                <input
                  name={`builder-project-name-${index}`}
                  value={item.name || ''}
                  onChange={(event) => onChange(index, { ...item, name: event.target.value })}
                  className={inputClass}
                  placeholder="Resume Builder…"
                />
              </label>
            ) : null}
            {show('role') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Role</span>
                <input
                  name={`builder-project-role-${index}`}
                  value={item.role || ''}
                  onChange={(event) => onChange(index, { ...item, role: event.target.value })}
                  className={inputClass}
                  placeholder="Full-stack developer…"
                />
              </label>
            ) : null}
            {show('start_date') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Start date</span>
                <input
                  name={`builder-project-start-${index}`}
                  value={item.start_date || ''}
                  onChange={(event) => onChange(index, { ...item, start_date: event.target.value })}
                  className={inputClass}
                  placeholder="Mar 2025…"
                />
              </label>
            ) : null}
            {show('end_date') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>End date</span>
                <input
                  name={`builder-project-end-${index}`}
                  value={item.end_date || ''}
                  onChange={(event) => onChange(index, { ...item, end_date: event.target.value })}
                  className={inputClass}
                  placeholder="Present…"
                />
              </label>
            ) : null}
            {show('scale') ? (
              <label className={fieldLabelClass}>
                <span className={fieldTextClass}>Scale</span>
                <input
                  name={`builder-project-scale-${index}`}
                  value={item.scale || ''}
                  onChange={(event) => onChange(index, { ...item, scale: event.target.value })}
                  className={inputClass}
                  placeholder="10k users…"
                />
              </label>
            ) : null}
          </div>

          {show('description') ? (
            <label className={fieldLabelClass}>
              <span className={fieldTextClass}>Description</span>
              <textarea
                name={`builder-project-description-${index}`}
                rows={4}
                value={item.description || ''}
                onChange={(event) => onChange(index, { ...item, description: event.target.value })}
                className={textareaClass}
                placeholder="Add one bullet per line…"
              />
            </label>
          ) : null}

          {show('link') || show('tech_stack') ? (
            <div className="grid gap-4 md:grid-cols-2">
              {show('link') ? (
                <label className={fieldLabelClass}>
                  <span className={fieldTextClass}>Project link</span>
                  <input
                    name={`builder-project-link-${index}`}
                    type="url"
                    autoComplete="url"
                    spellCheck={false}
                    value={item.link || ''}
                    onChange={(event) => onChange(index, { ...item, link: event.target.value })}
                    className={inputClass}
                    placeholder="https://project-demo.dev…"
                  />
                </label>
              ) : null}
              {show('tech_stack') ? (
                <label className={fieldLabelClass}>
                  <span className={fieldTextClass}>Tech stack</span>
                  <input
                    name={`builder-project-stack-${index}`}
                    value={(item.tech_stack || []).join(', ')}
                    onChange={(event) =>
                      onChange(index, {
                        ...item,
                        tech_stack: event.target.value.split(',').map((token) => token.trim()).filter(Boolean),
                      })
                    }
                    className={inputClass}
                    placeholder="React, FastAPI, Firestore…"
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button type="button" onClick={() => onRemove(index)} className={secondaryButtonClass}>
              Remove Project
            </button>
          </div>
        </section>
      ))}

      <button type="button" onClick={onAdd} className={secondaryButtonClass}>
        Add Project
      </button>
    </div>
  );
}
