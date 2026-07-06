import type { BuilderSkillGroup } from 'features/vault/utils/resumeSkills';

import { fieldLabelClass, fieldTextClass, inputClass, secondaryButtonClass, textareaClass } from './formStyles';

type SkillsSectionFormProps = {
  groups: BuilderSkillGroup[];
  onAddGroup: () => void;
  onGroupChange: (index: number, group: BuilderSkillGroup) => void;
  onRemoveGroup: (index: number) => void;
};

export default function SkillsSectionForm({
  groups,
  onAddGroup,
  onGroupChange,
  onRemoveGroup,
}: SkillsSectionFormProps) {
  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--cream-3)]">
          Add skill groups with your own labels — for example Languages, Cloud, or Design Tools.
        </p>
      ) : null}

      {groups.map((group, index) => (
        <section
          key={`skill-group-${index}`}
          className="space-y-4 rounded-lg border border-[var(--border-subtle)] p-4"
        >
          <label className={fieldLabelClass}>
            <span className={fieldTextClass}>Group name</span>
            <input
              name={`builder-skills-label-${index}`}
              value={group.label}
              onChange={(event) => onGroupChange(index, { ...group, label: event.target.value })}
              className={inputClass}
              placeholder="Languages, Frameworks, Tools…"
            />
          </label>

          <label className={fieldLabelClass}>
            <span className={fieldTextClass}>Skills</span>
            <textarea
              name={`builder-skills-items-${index}`}
              rows={3}
              value={group.itemsText ?? group.items.join(', ')}
              onChange={(event) => {
                const raw = event.target.value;
                onGroupChange(index, {
                  ...group,
                  itemsText: raw,
                  items: raw
                    .split(/[\n,]/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                });
              }}
              className={textareaClass}
              placeholder="Comma-separated skills…"
            />
          </label>

          <div className="flex justify-end">
            <button type="button" onClick={() => onRemoveGroup(index)} className={secondaryButtonClass}>
              Remove Group
            </button>
          </div>
        </section>
      ))}

      <button type="button" onClick={onAddGroup} className={secondaryButtonClass}>
        Add Skill Group
      </button>
    </div>
  );
}
