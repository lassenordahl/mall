/**
 * TanStack Query Provider
 * Wraps the app with QueryClientProvider for data fetching
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export interface QueryProviderProps {
  children: ReactNode;
}

/**
 * QueryProvider component
 * Creates and provides QueryClient instance to the app
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient instance (only once per app lifecycle)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Global defaults for all queries
            retry: 2,
            refetchOnWindowFocus: false,
            staleTime: 60 * 1000, // 1 minute
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
