import PageLoadingState from 'shared/components/PageLoadingState';

import type { useBuilderLanding } from '../../hooks/useBuilderLanding';

import BuilderDraftRow from './BuilderDraftRow';

type BuilderDraftHubProps = {
  landing: ReturnType<typeof useBuilderLanding>;
};

export default function BuilderDraftHub({ landing }: BuilderDraftHubProps) {
  const draftCount = landing.savedDrafts.length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="type-headline-md text-[var(--color-on-surface)]">Your drafts</h2>
          <p className="type-body-md mt-1 text-[var(--color-on-surface-variant)]">
            Pick up where you left off — rename anytime from the row menu.
          </p>
        </div>
        {draftCount > 0 ? (
          <span className="type-label-sm text-[var(--color-on-surface-variant)]">
            {draftCount} saved draft{draftCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      {landing.catalogLoading ? (
        <PageLoadingState variant="list" minHeightClassName="py-2" />
      ) : draftCount ? (
        <ul className="rb-draft-hub">
          {landing.savedDrafts.map((savedDraft) => (
            <li key={savedDraft.id}>
              <BuilderDraftRow
                draft={savedDraft}
                templates={landing.templates}
                focusRingClass={landing.focusRingClass}
                menuOpen={landing.openMenuDraftId === savedDraft.id}
                onToggleMenu={landing.toggleMenu}
                onOpen={landing.openDraft}
                onRename={landing.openRename}
                onDuplicate={landing.duplicateDraft}
                onDelete={landing.deleteDraft}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rb-draft-hub-empty glass-panel">
          <p className="type-body-md text-[var(--color-on-surface)]">No drafts yet</p>
          <p className="type-body-md mt-1 text-[var(--color-on-surface-variant)]">
            Start fresh or import from Vault above — your work saves automatically while you edit.
          </p>
        </div>
      )}
    </section>
  );
}
