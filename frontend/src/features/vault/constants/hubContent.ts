export const VAULT_HUB_COPY = {
  breadcrumbWorkspace: 'Workspace',
  breadcrumbVault: 'Resume Vault',
  eyebrow: 'Resume Vault',
  title: 'Resume Vault',
  subtitle:
    'Career infrastructure. Build with surgical precision or manage your hiring signal assets.',
  builderCard: {
    title: 'Resume Builder',
    description:
      'Author with AI from scratch or refine existing assets. Create a professional signal that powers Fit, Signal, and interview prep.',
    cta: 'Launch Builder',
  },
  libraryCard: {
    title: 'Resume Library',
    description:
      'Manage, upload, and version your documents. Keep your active resume aligned with the roles you target.',
    cta: 'Open Library',
  },
  activity: {
    title: 'Activity & Status',
    activeLabel: 'Active Asset',
    draftLabel: 'Recent Draft',
    noActive: 'No active resume yet',
    noDraft: 'No builder drafts yet',
  },
  quickUpload: {
    title: 'Quick Upload to Library',
    hint: 'Drop PDF, DOCX, or TXT here…',
    browse: 'Browse Files',
  },
  compareCard: {
    title: 'Compare Versions',
    description:
      'Analyze hiring signal across drafts to identify impact gaps before you apply.',
  },
} as const;

export const VAULT_SUB_NAV = [
  { label: 'Vetta Vault', href: '/resume-vault', end: true },
  { label: 'Build', href: '/resume-vault/builder' },
  { label: 'Library', href: '/resume-vault/library' },
  { label: 'Compare', href: '/resume-vault/compare' },
] as const;
