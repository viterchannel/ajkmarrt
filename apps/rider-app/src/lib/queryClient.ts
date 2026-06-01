import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      networkMode: "offlineFirst",
      /* Prevent background refetches from firing on every render while the
         device is online.  Individual queries override this where tighter
         freshness is needed (e.g. live ride requests use per-tier intervals). */
      staleTime: 10_000,
      /* Keep query errors as error state rather than propagating them as
         uncaught exceptions into the nearest ErrorBoundary.  Components that
         need to surface an error UI should read `isError`/`error` from the
         hook return value instead of relying on the boundary. */
      throwOnError: false,
    },
    mutations: {
      throwOnError: false,
    },
  },
});
