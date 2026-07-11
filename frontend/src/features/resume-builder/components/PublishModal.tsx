import Modal from 'shared/components/Modal';
import type { BuilderReadinessResult } from '../utils/builderReadiness';

type PublishModalProps = {
  open: boolean;
  publishing: boolean;
  hasExistingTarget: boolean;
  publishMode: 'new' | 'existing';
  resumeName: string;
  userNote: string;
  tags: string;
  setActive: boolean;
  readiness: BuilderReadinessResult;
  canPublish: boolean;
  onClose: () => void;
  onPublishModeChange: (mode: 'new' | 'existing') => void;
  onResumeNameChange: (value: string) => void;
  onUserNoteChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onSetActiveChange: (value: boolean) => void;
  onSubmit: () => void | Promise<void>;
};

const inputClass =
  'mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-0)] px-3 py-2.5 text-[var(--color-on-surface)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-primary)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]';

export default function PublishModal(props: PublishModalProps) {
  const totalIssues = props.readiness.blocking.length + props.readiness.warnings.length + props.readiness.info.length;

  return (
    <Modal open={props.open} onClose={props.onClose} title="Publish Resume">
      <div className="space-y-5 text-[var(--color-on-surface)]">
        <p className="type-body-md text-[var(--color-on-surface-variant)]">
          Publishing creates or updates a Vault resume. Draft changes only become part of Vault after this step.
        </p>

        <section
          className={[
            'rounded-[1rem] border p-4',
            props.canPublish
              ? 'border-[var(--border-subtle)] bg-[var(--bg-0)]/55'
              : 'border-[var(--color-error)]/25 bg-[var(--color-error)]/8',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="type-label-sm uppercase tracking-[0.14em] text-[var(--color-on-surface)]">Pre-publish review</h3>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                {props.canPublish
                  ? 'You can publish now. Review the warnings below if you want to tighten the resume first.'
                  : 'Resolve the blocking issues below before publishing to Vault.'}
              </p>
            </div>
            <span className="type-label-sm text-[var(--color-on-surface-variant)]">
              {props.readiness.strengths.length} strengths · {props.readiness.blocking.length} blocking · {props.readiness.warnings.length} warnings · {props.readiness.info.length} info
            </span>
          </div>

          {totalIssues > 0 || props.readiness.strengths.length > 0 ? (
            <div className="mt-3 space-y-3 text-sm">
              {props.readiness.strengths.length ? (
                <div>
                  <p className="font-semibold text-[var(--color-on-surface)]">What&apos;s already strong</p>
                  <ul className="mt-1 space-y-1.5 text-[var(--color-on-surface-variant)]">
                    {props.readiness.strengths.map((strength) => (
                      <li key={strength.id}>
                        <span className="font-medium text-[var(--color-on-surface)]">{strength.title}</span>
                        {` — ${strength.message}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {props.readiness.blocking.length ? (
                <div>
                  <p className="font-semibold text-[var(--color-error)]">Blocking</p>
                  <ul className="mt-1 space-y-1.5 text-[var(--color-on-surface-variant)]">
                    {props.readiness.blocking.map((issue) => (
                      <li key={issue.id}>
                        <span className="font-medium text-[var(--color-on-surface)]">{issue.title}</span>
                        {` — ${issue.message}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {props.readiness.warnings.length ? (
                <div>
                  <p className="font-semibold text-[var(--color-on-surface)]">Warnings</p>
                  <ul className="mt-1 space-y-1.5 text-[var(--color-on-surface-variant)]">
                    {props.readiness.warnings.map((issue) => (
                      <li key={issue.id}>
                        <span className="font-medium text-[var(--color-on-surface)]">{issue.title}</span>
                        {` — ${issue.message}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {props.readiness.info.length ? (
                <div>
                  <p className="font-semibold text-[var(--color-on-surface)]">Info</p>
                  <ul className="mt-1 space-y-1.5 text-[var(--color-on-surface-variant)]">
                    {props.readiness.info.map((issue) => (
                      <li key={issue.id}>
                        <span className="font-medium text-[var(--color-on-surface)]">{issue.title}</span>
                        {` — ${issue.message}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {props.canPublish && props.readiness.strengths.length ? (
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  You&apos;re publishing a resume that already has {props.readiness.strengths.length} documented strength{props.readiness.strengths.length === 1 ? '' : 's'} in the builder.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {props.hasExistingTarget ? (
          <fieldset className="space-y-3">
            <legend className="type-label-sm uppercase tracking-[0.14em] text-[var(--color-primary)]">Publish target</legend>
            <div className="grid gap-3">
              <label
                className={[
                  'flex items-start gap-3 rounded-[1rem] border p-3 text-sm transition-[border-color,background-color] duration-150',
                  props.publishMode === 'existing'
                    ? 'border-[var(--color-primary)]/32 bg-[var(--color-primary)]/10'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-0)]/55',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="builder-publish-target"
                  checked={props.publishMode === 'existing'}
                  onChange={() => props.onPublishModeChange('existing')}
                  className="mt-1"
                />
                <span className="leading-6">Publish as a new version of the linked Vault resume</span>
              </label>
              <label
                className={[
                  'flex items-start gap-3 rounded-[1rem] border p-3 text-sm transition-[border-color,background-color] duration-150',
                  props.publishMode === 'new'
                    ? 'border-[var(--color-primary)]/32 bg-[var(--color-primary)]/10'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-0)]/55',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="builder-publish-target"
                  checked={props.publishMode === 'new'}
                  onChange={() => props.onPublishModeChange('new')}
                  className="mt-1"
                />
                <span className="leading-6">Create a new Vault resume entry from this draft</span>
              </label>
            </div>
          </fieldset>
        ) : null}

        {props.publishMode === 'new' ? (
          <>
            <label className="block text-sm">
              <span className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">Vault resume name</span>
              <input
                name="builder-publish-name"
                autoComplete="off"
                value={props.resumeName}
                onChange={(event) => props.onResumeNameChange(event.target.value)}
                className={inputClass}
                placeholder="Software Engineer Resume…"
              />
            </label>

            <label className="block text-sm">
              <span className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">Tags</span>
              <input
                name="builder-publish-tags"
                autoComplete="off"
                value={props.tags}
                onChange={(event) => props.onTagsChange(event.target.value)}
                className={inputClass}
                placeholder="Backend, India, 2026…"
              />
            </label>
          </>
        ) : null}

        <label className="block text-sm">
          <span className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">Version note</span>
          <textarea
            name="builder-publish-note"
            rows={4}
            value={props.userNote}
            onChange={(event) => props.onUserNoteChange(event.target.value)}
            className={inputClass}
            placeholder="What changed in this version…"
          />
        </label>

        <label className="flex items-start gap-3 rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--bg-0)]/55 p-3 text-sm text-[var(--cream-2)]">
          <input
            type="checkbox"
            checked={props.setActive}
            onChange={(event) => props.onSetActiveChange(event.target.checked)}
            className="mt-1"
          />
          <span>Set this resume as your active Vault resume after publish</span>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm text-[var(--cream-1)] transition-[border-color,background-color,box-shadow] duration-150 hover:bg-[var(--bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void props.onSubmit()}
            disabled={props.publishing || !props.canPublish}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-primary)] transition-[background-color,box-shadow] duration-150 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {props.publishing ? 'Publishing…' : 'Publish to Vault'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

