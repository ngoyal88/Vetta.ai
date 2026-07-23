import type { ResumeBuilderDraft } from '../types/resumeBuilder';

export type DraftSourceKind = 'blank' | 'vault_fork';

export function resolveDraftSourceKind(draft: ResumeBuilderDraft): DraftSourceKind {
  if (draft.source_kind) return draft.source_kind;
  return draft.source_resume_id ? 'vault_fork' : 'blank';
}

export function draftSourceLabel(kind: DraftSourceKind): string {
  return kind === 'vault_fork' ? 'From Vault' : 'Blank';
}
