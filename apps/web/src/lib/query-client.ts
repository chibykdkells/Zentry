import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        // Short initial retry so that queries which fire before AuthBootstrap
        // sets the access token (and get a 401 with no auth header) recover
        // quickly once the token arrives, without a full 1-second stall.
        retryDelay: 400,
        refetchOnWindowFocus: false,
      },
    },
  });
}
