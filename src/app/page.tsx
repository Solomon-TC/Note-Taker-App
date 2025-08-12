"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Page() {
  const router = useRouter();
  const { user, loading, error } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const redirectAttempted = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Prevent multiple redirect attempts
    if (redirectAttempted.current || loading || redirecting) return;

    // Set a timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      console.warn("Redirect timeout - forcing navigation to auth");
      if (!redirectAttempted.current) {
        redirectAttempted.current = true;
        setRedirecting(true);
        window.location.href = "/auth";
      }
    }, 3000); // 3 second timeout

    if (!loading) {
      redirectAttempted.current = true;
      setRedirecting(true);

      console.log("Redirecting user:", {
        hasUser: !!user,
        userEmail: user?.email,
        hasError: !!error,
        error: error,
      });

      if (user && !error) {
        console.log("User authenticated, redirecting to dashboard");
        window.location.href = "/dashboard";
      } else {
        console.log("No user or error present, redirecting to auth");
        window.location.href = "/auth";
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, loading, error, redirecting]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleForceAuth = () => {
    redirectAttempted.current = true;
    setRedirecting(true);
    router.push("/auth");
  };

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button onClick={handleForceAuth}>Go to Sign In</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">
          {redirecting ? "Redirecting..." : "Loading..."}
        </p>
        {!redirecting && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForceAuth}
            className="mt-4"
          >
            Continue to Sign In
          </Button>
        )}
      </div>
    </div>
  );
}
