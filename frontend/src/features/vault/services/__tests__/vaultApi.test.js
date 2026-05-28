import { vi } from 'vitest';

vi.mock('firebaseConfig', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('test-token'),
    },
  },
}));

import { vaultApi } from '../vaultApi';

function mockJsonResponse(body, { ok = true, status = 200, contentType = 'application/json' } = {}) {
  return {
    ok,
    status,
    headers: {
      get: () => contentType,
    },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('vaultApi', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('compare sends version ids in request body', async () => {
    global.fetch.mockResolvedValueOnce(
      mockJsonResponse({
        score_a: 80,
        score_b: 70,
        score_delta: 10,
        skills_only_in_a: [],
        skills_only_in_b: [],
        recommended_id: 'a',
        recommendation_reason: 'test',
        section_verdicts: {},
      }),
    );

    await vaultApi.compare('resume-a', 'resume-b', 'Engineer', 'ver-a', 'ver-b');

    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.version_a_id).toBe('ver-a');
    expect(body.version_b_id).toBe('ver-b');
  });

  it('surfaces backend error details', async () => {
    global.fetch.mockResolvedValueOnce(
      mockJsonResponse({ detail: 'Resume name cannot be blank.' }, { ok: false, status: 400 }),
    );

    await expect(vaultApi.updateEntry('resume-1', { name: '   ' })).rejects.toThrow(
      'Resume name cannot be blank.',
    );
  });

  it('falls back to the first resume with a current version', async () => {
    global.fetch
      .mockResolvedValueOnce(
        mockJsonResponse({
          entries: [
            {
              id: 'resume-1',
              name: 'Backend Resume',
              tags: ['python'],
              is_active: false,
              version_count: 1,
              current_version_id: 'version-1',
            },
          ],
          meta: {
            resume_count: 1,
            active_resume_id: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          id: 'version-1',
          resume_id: 'resume-1',
          version_number: 1,
          created_at: '2026-05-13T18:00:00.000Z',
          user_note: '',
          score_at_version: 78,
          profile_snapshot: {
            summary: 'Backend-focused profile',
          },
        }),
      );

    await expect(vaultApi.getActiveResumeProfile()).resolves.toEqual({
      summary: 'Backend-focused profile',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
