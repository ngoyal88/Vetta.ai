import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import VaultHubPage from '../VaultHubPage';

const mockUseVaultLibraryContext = vi.fn();

vi.mock('../../context/VaultLibraryContext', () => ({
  useVaultLibraryContext: () => mockUseVaultLibraryContext(),
  VaultLibraryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

function baseLibrary(overrides = {}) {
  return {
    entries: [],
    meta: { resume_count: 0, active_resume_id: null },
    loading: false,
    error: '',
    refresh: vi.fn(),
    uploadResume: vi.fn(),
    deleteEntry: vi.fn(),
    setActive: vi.fn(),
    updateMeta: vi.fn(),
    reanalyze: vi.fn(),
    compare: vi.fn(),
    getVersions: vi.fn(),
    restoreVersion: vi.fn(),
    ...overrides,
  };
}

describe('VaultHubPage', () => {
  beforeEach(() => {
    mockUseVaultLibraryContext.mockReset();
  });

  it('shows empty vault prompt when no resumes', () => {
    mockUseVaultLibraryContext.mockReturnValue(baseLibrary());
    render(<VaultHubPage />);
    expect(screen.getByText(/upload your first resume/i)).toBeInTheDocument();
  });

  it('shows compare and library shortcuts when resumes exist', () => {
    mockUseVaultLibraryContext.mockReturnValue(
      baseLibrary({
        entries: [
          {
            id: 'r1',
            name: 'Test',
            tags: [],
            is_active: true,
            version_count: 1,
          },
        ],
        meta: { resume_count: 1, active_resume_id: 'r1' },
      }),
    );
    render(<VaultHubPage />);
    expect(screen.getByText('Compare')).toBeInTheDocument();
    expect(screen.getByText('My library')).toBeInTheDocument();
  });
});
