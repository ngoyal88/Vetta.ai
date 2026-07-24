export const queryKeys = {
  vault: {
    all: ['vault'] as const,
    entries: () => [...queryKeys.vault.all, 'entries'] as const,
    versions: (resumeId: string) => [...queryKeys.vault.all, 'versions', resumeId] as const,
    version: (versionId: string) => [...queryKeys.vault.all, 'version', versionId] as const,
  },
  resumeBuilder: {
    all: ['resume-builder'] as const,
    health: () => [...queryKeys.resumeBuilder.all, 'health'] as const,
    templates: () => [...queryKeys.resumeBuilder.all, 'templates'] as const,
    drafts: () => [...queryKeys.resumeBuilder.all, 'drafts'] as const,
    draft: (draftId: string) => [...queryKeys.resumeBuilder.all, 'draft', draftId] as const,
  },
  interview: {
    history: (limit: number) => ['interview', 'history', { limit }] as const,
  },
  profile: {
    claims: (section: string) => ['profile', 'claims', { section }] as const,
    memory: (limit: number) => ['profile', 'memory', { limit }] as const,
  },
  user: {
    settings: (uid: string) => ['user', 'settings', uid] as const,
  },
  applicationFit: {
    history: (role: string, jd: string) => ['application-fit', 'history', { role, jd }] as const,
    snapshot: (id: string) => ['application-fit', 'snapshot', id] as const,
  },
};
