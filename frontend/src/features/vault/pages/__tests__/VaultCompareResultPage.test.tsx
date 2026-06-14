import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

import VaultCompareResultPage from '../VaultCompareResultPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../../context/VaultLibraryContext', () => ({
  useVaultLibraryContext: () => ({
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
  }),
  VaultLibraryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('VaultCompareResultPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('redirects to compare picker when location state is missing', () => {
    render(<VaultCompareResultPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/resume-vault/compare', { replace: true });
  });
});
