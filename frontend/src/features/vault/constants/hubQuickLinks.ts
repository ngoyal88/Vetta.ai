import { FolderOpen, GitCompare, type LucideIcon } from 'lucide-react';

export type VaultHubQuickLinkColor = 'teal' | 'primary';

export type VaultHubQuickLink = {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: VaultHubQuickLinkColor;
};

export const VAULT_HUB_QUICK_LINKS: VaultHubQuickLink[] = [
  {
    to: '/resume-vault/compare',
    icon: GitCompare,
    title: 'Compare Versions',
    description:
      'See what changed between two versions — skills, impact, and wording — before you apply.',
    color: 'teal',
  },
  {
    to: '/resume-vault/library',
    icon: FolderOpen,
    title: 'My Library',
    description: 'Every resume and version you have uploaded, organized and ready when you need it.',
    color: 'primary',
  },
];
