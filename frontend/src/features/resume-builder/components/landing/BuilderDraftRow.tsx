import { memo } from 'react';
import { FileText } from 'lucide-react';

import type { ResumeBuilderDraft, TemplateMetadata } from '../../types/resumeBuilder';
import { getDraftListTitle, getTemplateAccentTags } from '../../utils/draftListPresentation';
import { getDraftDisplayName } from '../../utils/draftNames';
import { draftSourceLabel, resolveDraftSourceKind } from '../../utils/resolveDraftSourceKind';
import { formatRelativeUpdatedAt } from 'features/vault/utils/vaultUtils';

import BuilderDraftRowMenu from './BuilderDraftRowMenu';

type BuilderDraftRowProps = {
  draft: ResumeBuilderDraft;
  templates: TemplateMetadata[];
  focusRingClass: string;
  menuOpen: boolean;
  onToggleMenu: (draftId: string) => void;
  onOpen: (draftId: string) => void;
  onRename: (draftId: string, name: string) => void;
  onDuplicate: (draftId: string) => void;
  onDelete: (draftId: string) => void;
};

function BuilderDraftRow({
  draft,
  templates,
  focusRingClass,
  menuOpen,
  onToggleMenu,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: BuilderDraftRowProps) {
  const sourceKind = resolveDraftSourceKind(draft);
  const template = templates.find((entry) => entry.id === draft.template_id);
  const templateTags = getTemplateAccentTags(template);
  const title = getDraftListTitle(draft);
  const updatedLabel = formatRelativeUpdatedAt(draft.updated_at);

  return (
    <article
      className={['rb-draft-row glass-panel', menuOpen ? 'rb-draft-row--menu-open' : ''].join(' ')}
    >
      <div className="rb-draft-row__inner">
        <button
          type="button"
          onClick={() => onOpen(draft.id)}
          className={`rb-draft-row__open ${focusRingClass}`}
        >
          <div className="rb-draft-row__icon" aria-hidden>
            <FileText className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="type-body-md truncate font-semibold text-[var(--color-on-surface)]">
                  {title}
                </h3>
              </div>
              <span className="rb-draft-row__time shrink-0">{updatedLabel}</span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {sourceKind === 'vault_fork' ? (
                <span className="rb-draft-row__chip rb-draft-row__chip--source">
                  {draftSourceLabel(sourceKind)}
                </span>
              ) : null}
              {templateTags.map((tag) => (
                <span key={`${draft.id}-${tag}`} className="rb-draft-row__chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </button>

        <BuilderDraftRowMenu
          draftId={draft.id}
          isOpen={menuOpen}
          onToggle={onToggleMenu}
          onOpen={() => onOpen(draft.id)}
          onRename={() => onRename(draft.id, getDraftDisplayName(draft))}
          onDuplicate={() => void onDuplicate(draft.id)}
          onDelete={() => onDelete(draft.id)}
        />
      </div>
    </article>
  );
}

export default memo(BuilderDraftRow);
