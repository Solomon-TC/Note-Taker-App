"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import UserMenu from "@/components/auth/UserMenu";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowLeft,
  Users,
  UserPlus,
  MessageCircle,
  Settings,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Database } from "@/types/supabase";

type User = Database["public"]["Tables"]["users"]["Row"];

export default function FriendsPage() {
  const { user: authUser, loading, error } = useAuth();
  const router = useRouter();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [sessionDebug, setSessionDebug] = useState<any>(null);

  // Comprehensive session and user debugging
  const performDebugChecks = async () => {
    try {
      const supabase = createClient();

      console.log("🔍 Friends Page: Starting debug checks...");

      // Check session with more detailed logging
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.log("🔍 Friends Page: Session check:", {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        provider: session?.user?.app_metadata?.provider,
        sessionError: sessionError?.message,
        accessToken: session?.access_token ? "[PRESENT]" : "[MISSING]",
        refreshToken: session?.refresh_token ? "[PRESENT]" : "[MISSING]",
        expiresAt: session?.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : "[MISSING]",
        tokenType: session?.token_type,
        userMetadata: session?.user?.user_metadata,
        appMetadata: session?.user?.app_metadata,
      });

      setSessionDebug({
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        provider: session?.user?.app_metadata?.provider,
        sessionError: sessionError?.message,
        accessToken: session?.access_token ? "[PRESENT]" : "[MISSING]",
        refreshToken: session?.refresh_token ? "[PRESENT]" : "[MISSING]",
        expiresAt: session?.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : "[MISSING]",
        tokenType: session?.token_type,
      });

      // Check users table with error handling
      let users = null;
      let usersError = null;
      try {
        const result = await supabase.from("users").select("*");
        users = result.data;
        usersError = result.error;
        console.log("🔍 Friends Page: Users query:", {
          usersCount: users?.length || 0,
          usersError: usersError?.message,
          usersErrorCode: usersError?.code,
        });
      } catch (err) {
        console.error("🔍 Friends Page: Users query failed:", err);
        usersError = err;
      }

      // Check current user in users table
      if (session?.user?.id) {
        try {
          const { data: currentDbUser, error: currentUserError } =
            await supabase
              .from("users")
              .select("*")
              .eq("id", session.user.id)
              .single();

          console.log("🔍 Friends Page: Current user in DB:", {
            hasCurrentDbUser: !!currentDbUser,
            currentDbUser: currentDbUser
              ? {
                  id: currentDbUser.id,
                  email: currentDbUser.email,
                  full_name: currentDbUser.full_name,
                  avatar_url: currentDbUser.avatar_url,
                }
              : null,
            currentUserError: currentUserError?.message,
            currentUserErrorCode: currentUserError?.code,
          });
          setDbUser(currentDbUser);
        } catch (err) {
          console.error("🔍 Friends Page: Current user query failed:", err);
          setDbUser(null);
        }
      }

      setDebugInfo({
        authUser: authUser
          ? {
              id: authUser.id,
              email: authUser.email,
              provider: authUser.app_metadata?.provider,
              hasUserMetadata: !!authUser.user_metadata,
              userMetadataKeys: authUser.user_metadata
                ? Object.keys(authUser.user_metadata)
                : [],
            }
          : null,
        session: session
          ? {
              userId: session.user.id,
              email: session.user.email,
              provider: session.user.app_metadata?.provider,
              hasUserMetadata: !!session.user.user_metadata,
              userMetadataKeys: session.user.user_metadata
                ? Object.keys(session.user.user_metadata)
                : [],
            }
          : null,
        usersInDb: users?.length || 0,
        sessionError: sessionError?.message,
        usersError:
          usersError?.message ||
          (usersError instanceof Error ? usersError.message : "Unknown error"),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("🔍 Friends Page: Debug check error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
      });
      setDebugInfo({
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Handle authentication redirects with enhanced debugging
  useEffect(() => {
    console.log("🔍 Friends Page: Auth state:", {
      loading,
      hasAuthUser: !!authUser,
      authUserId: authUser?.id,
      authUserEmail: authUser?.email,
      authUserProvider: authUser?.app_metadata?.provider,
      error,
    });

    if (!loading) {
      // Perform debug checks regardless of auth state
      performDebugChecks();

      if (!authUser) {
        console.log(
          "🔍 Friends Page: User not authenticated, redirecting to auth",
        );
        router.push("/auth");
      }
    }
  }, [authUser, loading, router, error]);

  // Show error screen for authentication errors
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push("/auth")}>Go to Sign In</Button>
        </div>
      </div>
    );
  }

  // Show loading screen while authentication is loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if user is not authenticated (redirect will happen via useEffect)
  if (!authUser) {
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
                  <Users className="h-5 w-5" />
                </div>
                <h1 className="dashboard-heading">Friends</h1>
              </div>
            </div>

            {/* Right side - Debug button and User menu */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={performDebugChecks}
                className="sleek-button hover-glow"
                title="Refresh debug info"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      {/* Debug Information Panel */}
      {(debugInfo || sessionDebug) && (
        <div className="max-w-6xl mx-auto px-4 mb-6">
          <div className="dashboard-card">
            <div className="dashboard-card-header px-6 py-4">
              <h2 className="dashboard-subheading">Debug Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Session Debug */}
                {sessionDebug && (
                  <div>
                    <h3 className="font-semibold mb-2">Session Status</h3>
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                      {JSON.stringify(sessionDebug, null, 2)}
                    </pre>
                  </div>
                )}

                {/* General Debug */}
                {debugInfo && (
                  <div>
                    <h3 className="font-semibold mb-2">Auth & DB Status</h3>
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                      {JSON.stringify(debugInfo, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Database User */}
                {dbUser && (
                  <div className="md:col-span-2">
                    <h3 className="font-semibold mb-2">Database User Record</h3>
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                      {JSON.stringify(dbUser, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Friends List */}
          <div className="lg:col-span-2">
            <div className="dashboard-card">
              <div className="dashboard-card-header px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="dashboard-subheading">Your Friends</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="sleek-button hover-glow"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Friend
                  </Button>
                </div>
              </div>
              <div className="p-6">
                {/* Empty state for now */}
                <div className="text-center py-12">
                  <div className="stats-card-icon mx-auto mb-4 opacity-50">
                    <Users className="h-8 w-8" />
                  </div>
                  <h3 className="dashboard-heading mb-2">No friends yet</h3>
                  <p className="dashboard-body mb-6 max-w-md mx-auto">
                    Connect with classmates and study partners to share notes
                    and collaborate on your learning journey.
                  </p>
                  <Button className="hover-glow">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Find Friends
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Friend Requests */}
            <div className="dashboard-card">
              <div className="dashboard-card-header px-4 py-3">
                <h3 className="dashboard-subheading">Friend Requests</h3>
              </div>
              <div className="p-4">
                <div className="text-center py-6">
                  <div className="stats-card-icon mx-auto mb-3 opacity-50">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <p className="dashboard-body text-sm">No pending requests</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="dashboard-card">
              <div className="dashboard-card-header px-4 py-3">
                <h3 className="dashboard-subheading">Quick Actions</h3>
              </div>
              <div className="p-4 space-y-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start sleek-button hover-glow"
                >
                  <UserPlus className="h-4 w-4 mr-3" />
                  Send Friend Request
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start sleek-button hover-glow"
                >
                  <MessageCircle className="h-4 w-4 mr-3" />
                  Start Group Chat
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start sleek-button hover-glow"
                >
                  <Settings className="h-4 w-4 mr-3" />
                  Privacy Settings
                </Button>
              </div>
            </div>

            {/* Study Groups */}
            <div className="dashboard-card">
              <div className="dashboard-card-header px-4 py-3">
                <h3 className="dashboard-subheading">Study Groups</h3>
              </div>
              <div className="p-4">
                <div className="text-center py-6">
                  <div className="stats-card-icon mx-auto mb-3 opacity-50">
                    <Users className="h-5 w-5" />
                  </div>
                  <p className="dashboard-body text-sm">No study groups yet</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
