'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorId?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void; errorId: string }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = this.state.errorId || 'unknown';
    
    console.error('🚨 Error Boundary caught an error:', {
      errorId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.retryCount,
    });
    
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // You can integrate with error tracking services here
      console.error('Production error:', {
        errorId,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
    }
  }

  retry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`🔄 Retrying error boundary (attempt ${this.retryCount}/${this.maxRetries})`);
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    } else {
      console.error('🚨 Max retries reached, forcing page reload');
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error!} 
            retry={this.retry} 
            errorId={this.state.errorId || 'unknown'}
          />
        );
      }

      return (
        <DefaultErrorFallback 
          error={this.state.error!} 
          retry={this.retry} 
          errorId={this.state.errorId || 'unknown'}
          retryCount={this.retryCount}
          maxRetries={this.maxRetries}
        />
      );
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ 
  error, 
  retry, 
  errorId, 
  retryCount, 
  maxRetries 
}: { 
  error: Error; 
  retry: () => void; 
  errorId: string;
  retryCount: number;
  maxRetries: number;
}) {
  const isInfiniteLoop = error.message.includes('418') || 
                        error.message.includes('Maximum update depth exceeded') ||
                        error.message.includes('Too many re-renders');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {isInfiniteLoop ? 'Rendering Loop Detected' : 'Something went wrong'}
          </AlertTitle>
          <AlertDescription className="mt-2">
            {isInfiniteLoop ? (
              'The application encountered an infinite rendering loop. This has been automatically stopped to prevent browser crashes.'
            ) : process.env.NODE_ENV === 'development' ? (
              error.message 
            ) : (
              'An unexpected error occurred. Please try again.'
            )}
          </AlertDescription>
        </Alert>
        
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          Error ID: {errorId}
          {retryCount > 0 && ` • Retry ${retryCount}/${maxRetries}`}
        </div>
        
        <div className="flex gap-2">
          {retryCount < maxRetries ? (
            <Button onClick={retry} variant="outline" className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again ({maxRetries - retryCount} left)
            </Button>
          ) : (
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Page
            </Button>
          )}
          <Button 
            onClick={() => window.location.href = '/'} 
            variant="default" 
            className="flex-1"
          >
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 p-4 bg-muted rounded-lg">
            <summary className="cursor-pointer font-medium">Error Details</summary>
            <pre className="mt-2 text-sm overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; retry: () => void; errorId: string }>
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// React Suspense error boundary for async components
export function AsyncErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('🚨 Async Error Boundary:', { error, errorInfo });
      }}
    >
      <React.Suspense 
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }
      >
        {children}
      </React.Suspense>
    </ErrorBoundary>
  );
}