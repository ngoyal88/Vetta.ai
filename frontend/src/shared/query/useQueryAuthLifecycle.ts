import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from 'shared/context/AuthContext';

/** Clear all cached user data when auth session ends. */
export function useQueryAuthLifecycle(): void {
  const queryClient = useQueryClient();
  const { authReady, currentUser } = useAuth();
  const hadUserRef = useRef(false);

  useEffect(() => {
    if (!authReady) return;

    if (currentUser) {
      hadUserRef.current = true;
      return;
    }

    if (hadUserRef.current) {
      queryClient.clear();
      hadUserRef.current = false;
    }
  }, [authReady, currentUser, queryClient]);
}
