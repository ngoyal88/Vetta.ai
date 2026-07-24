import { useAuth } from 'shared/context/AuthContext';

/** Gate authenticated queries until Firebase auth bootstrap completes. */
export function useAuthQueryEnabled(): boolean {
  const { authReady, currentUser } = useAuth();
  return authReady && Boolean(currentUser);
}
