/**
 * Production error logging utility
 */

interface ErrorLog {
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
  userId?: string;
  environment: string;
}

class ErrorLogger {
  private static instance: ErrorLogger;
  private logs: ErrorLog[] = [];

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  log(error: Error | string, context?: Record<string, any>) {
    const errorLog: ErrorLog = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      timestamp: new Date().toISOString(),
      userId: context?.userId,
      environment: process.env.NODE_ENV || 'unknown',
    };

    this.logs.push(errorLog);

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Error logged:', errorLog);
    }

    // In production, you could send to external service
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(errorLog);
    }
  }

  private async sendToExternalService(errorLog: ErrorLog) {
    try {
      // Example: Send to your own API endpoint
      if (typeof window !== 'undefined') {
        fetch('/api/error-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(errorLog),
        }).catch(err => {
          console.error('Failed to send error log:', err);
        });
      }
    } catch (error) {
      console.error('Error logging service failed:', error);
    }
  }

  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const errorLogger = ErrorLogger.getInstance();

// Global error handlers
if (typeof window !== 'undefined') {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorLogger.log(`Unhandled Promise Rejection: ${event.reason}`);
  });

  // Handle JavaScript errors
  window.addEventListener('error', (event) => {
    errorLogger.log(event.error || event.message);
  });
}

// Next.js error reporting
export function reportError(error: Error, errorInfo?: any) {
  errorLogger.log(error, errorInfo);
}

export default errorLogger;