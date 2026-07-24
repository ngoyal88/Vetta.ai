import { useApplicationFitHistoryQuery } from '../queries/useApplicationFitQueries';

export function useApplicationFitHistory(targetRole: string, jobDescription: string) {
  const { history, loading, error } = useApplicationFitHistoryQuery(targetRole, jobDescription);

  return { history, loading, error };
}
