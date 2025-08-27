"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import UserMenu from "@/components/auth/UserMenu";
import FeedbackBoard from "@/components/feedback/FeedbackBoard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useEffect } from "react";

export default function FeedbackPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="dashboard-card m-4 mb-6">
        <div className="dashboard-card-header px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - Back button and title */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="sleek-button hover-glow"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div className="flex items-center gap-3">
                <div className="stats-card-icon">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h1 className="dashboard-heading">Feedback</h1>
              </div>
            </div>

            {/* Right side - User menu */}
            <div className="flex items-center gap-3">
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Feedback Board */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <FeedbackBoard />
      </div>
    </div>
  );
}
