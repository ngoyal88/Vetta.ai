import { useMemo } from 'react';

import { useBuilderDraftsQuery } from 'features/resume-builder/queries/useBuilderCatalogQueries';
import { getDraftDisplayName } from 'features/resume-builder/utils/draftNames';

export function useRecentBuilderDraft() {
  const { drafts, loading } = useBuilderDraftsQuery();

  const recentDraft = useMemo(() => {
    if (!drafts.length) return null;
    const sorted = [...drafts].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    const latest = sorted[0];
    return latest ? { id: latest.id, label: getDraftDisplayName(latest) } : null;
  }, [drafts]);

  return { recentDraft, loading };
}
