import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../hooks/useAuth';
import ErrorBoundary from '../components/ErrorBoundary';
import QueryErrorBoundary from '../components/QueryErrorBoundary';
import '@/styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Error handling for queries
      throwOnError: true,
    },
    mutations: {
      // Error handling for mutations
      throwOnError: true,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <QueryErrorBoundary>
          <AuthProvider>
            <Component {...pageProps} />
          </AuthProvider>
        </QueryErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}