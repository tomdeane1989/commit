import React from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import ErrorBoundary from './ErrorBoundary';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface QueryErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo;
  retry: () => void;
}

const QueryErrorFallback: React.FC<QueryErrorFallbackProps> = ({ error, retry }) => {
  const isNetworkError = error.message.includes('Network Error') || error.message.includes('fetch');
  const isAPIError = error.message.includes('Request failed');
  const isTimeoutError = error.message.includes('timeout');
  
  let title = 'Something went wrong';
  let message = 'An unexpected error occurred. Please try again.';
  let icon = AlertTriangle;
  
  if (isNetworkError) {
    title = 'Connection Problem';
    message = 'Unable to connect to the server. Please check your internet connection and try again.';
    icon = WifiOff;
  } else if (isAPIError) {
    title = 'Server Error';
    message = 'The server encountered an error. Please try again in a few moments.';
    icon = AlertTriangle;
  } else if (isTimeoutError) {
    title = 'Request Timeout';
    message = 'The request took too long to complete. Please try again.';
    icon = RefreshCw;
  }
  
  const Icon = icon;
  
  return (
    <div className="flex flex-col items-center justify-center min-h-64 p-8">
      <div className="text-center max-w-md">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <Icon className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="space-y-3">
          <button
            onClick={retry}
            className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors hover:opacity-90"
            style={{ backgroundColor: '#82a365', '--tw-ring-color': '#82a365' } as React.CSSProperties}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
            style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}
          >
            Reload Page
          </button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left bg-gray-50 rounded-lg p-4">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
              Error Details (Development)
            </summary>
            <div className="mt-3 text-xs text-gray-600">
              <p className="mb-2"><strong>Message:</strong> {error.message}</p>
              <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {error.stack}
              </pre>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

// Component that wraps React Query operations with error boundary
interface QueryErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<QueryErrorFallbackProps>;
}

const QueryErrorBoundary: React.FC<QueryErrorBoundaryProps> = ({ 
  children, 
  fallback = QueryErrorFallback 
}) => {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          fallback={fallback}
          onError={(error, errorInfo) => {
            console.error('Query Error Boundary caught an error:', error, errorInfo);
            // In production, you might want to log this to an error reporting service
          }}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};

export default QueryErrorBoundary;