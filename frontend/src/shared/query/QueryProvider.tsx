import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { isE2EMockAuthEnabled, type VettaE2EWindow } from 'shared/e2e/e2eMockAuth';
import { invalidateAfterInterview } from 'shared/query/invalidateCaches';
import { getQueryClient } from './queryClient';
import { useQueryAuthLifecycle } from './useQueryAuthLifecycle';

type QueryProviderProps = {
  children: React.ReactNode;
};

function QueryAuthLifecycle() {
  useQueryAuthLifecycle();
  return null;
}

export default function QueryProvider({ children }: QueryProviderProps) {
  const queryClient = getQueryClient();

  useEffect(() => {
    if (!isE2EMockAuthEnabled()) return undefined;
    (window as VettaE2EWindow).__VETTA_E2E__ = {
      invalidateAfterInterview: () => invalidateAfterInterview(queryClient),
    };
    return () => {
      delete (window as VettaE2EWindow).__VETTA_E2E__;
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <QueryAuthLifecycle />
      {children}
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" /> : null}
    </QueryClientProvider>
  );
}
