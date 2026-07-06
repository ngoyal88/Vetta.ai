import type { ResumeAchievementItem } from 'features/vault/types/domain';

import { fieldLabelClass, fieldTextClass, inputClass, secondaryButtonClass, textareaClass } from './formStyles';

type AchievementsSectionFormProps = {
  items: ResumeAchievementItem[];
  onAdd: () => void;
  onChange: (index: number, item: ResumeAchievementItem) => void;
  onRemove: (index: number) => void;
};

export default function AchievementsSectionForm({ items, onAdd, onChange, onRemove }: AchievementsSectionFormProps) {
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--cream-3)]">
          Add achievements, awards, or notable wins.
        </p>
      ) : null}

      {items.map((item, index) => (
        <section key={`achievement-${index}`} className="space-y-4 rounded-lg border border-[var(--border-subtle)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={fieldLabelClass}>
              <span className={fieldTextClass}>Title</span>
              <input
                name={`builder-achievement-title-${index}`}
                value={item.title || ''}
                onChange={(event) => onChange(index, { ...item, title: event.target.value })}
                className={inputClass}
                placeholder="Meta Hacker Cup…"
              />
            </label>
            <label className={fieldLabelClass}>
              <span className={fieldTextClass}>Date / year</span>
              <input
                name={`builder-achievement-date-${index}`}
                value={item.date || ''}
                onChange={(event) => onChange(index, { ...item, date: event.target.value })}
                className={inputClass}
                placeholder="2025…"
              />
            </label>
          </div>

          <label className={fieldLabelClass}>
            <span className={fieldTextClass}>Description</span>
            <textarea
              name={`builder-achievement-description-${index}`}
              rows={4}
              value={item.description || ''}
              onChange={(event) => onChange(index, { ...item, description: event.target.value })}
              className={textareaClass}
              placeholder="Describe why this matters…"
            />
          </label>

          <div className="flex justify-end">
            <button type="button" onClick={() => onRemove(index)} className={secondaryButtonClass}>
              Remove Achievement
            </button>
          </div>
        </section>
      ))}

      <button type="button" onClick={onAdd} className={secondaryButtonClass}>
        Add Achievement
      </button>
    </div>
  );
}

