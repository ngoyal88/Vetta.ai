import { QueryClient } from '@tanstack/react-query';

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('not authenticated') || message.includes('401');
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: 'online',
        retry: (failureCount, error) => {
          if (isAuthError(error)) return false;
          return failureCount < 1;
        },
      },
    },
  });
}

let queryClientSingleton: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!queryClientSingleton) {
    queryClientSingleton = createQueryClient();
  }
  return queryClientSingleton;
}
