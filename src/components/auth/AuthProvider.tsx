"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  error: null,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let supabase: ReturnType<typeof createClient>;
    let authMounted = true;
    let subscription: any;

    const initializeAuth = async () => {
      try {
        supabase = createClient();

        console.log("🔐 AuthProvider: Initializing authentication...");

        // Get initial session first
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        console.log("🔐 AuthProvider: Initial session check:", {
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          provider: session?.user?.app_metadata?.provider,
          sessionError: sessionError?.message,
        });

        if (!authMounted) return;

        // Set initial state
        setSession(session);
        setUser(session?.user ?? null);
        setError(sessionError?.message || null);
        setLoading(false);

        // Set up auth state change listener after initial state is set
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!authMounted) return;

          console.log("🔐 AuthProvider: Auth state change:", {
            event,
            hasSession: !!session,
            userId: session?.user?.id,
            userEmail: session?.user?.email,
            provider: session?.user?.app_metadata?.provider,
          });

          setSession(session);
          setUser(session?.user ?? null);
          setError(null);

          // User records are now automatically created by database trigger
          // No manual intervention needed for new sign-ins
          if (session?.user && event === "SIGNED_IN") {
            console.log(
              "🔐 AuthProvider: User signed in, record automatically synced:",
              {
                userId: session.user.id,
                email: session.user.email,
                provider: session.user.app_metadata?.provider,
              },
            );
          }
        });

        subscription = authSubscription;

        // User records are automatically synced by database trigger
        if (session?.user) {
          console.log("🔐 AuthProvider: Existing session loaded:", {
            userId: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
          });
        }
      } catch (err) {
        console.error("🔐 AuthProvider: Auth initialization error:", err);
        if (authMounted) {
          setError("Failed to initialize authentication");
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      authMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [mounted]);

  // User records are now automatically managed by database triggers
  // This function is no longer needed but kept for reference
  // const ensureUserRecord = async (...) => { ... }

  const signOut = async () => {
    try {
      // Set loading state to prevent further operations
      setLoading(true);

      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        if (mounted) {
          setError(error.message);
          setLoading(false);
        }
      } else {
        // Clear all state before navigation
        if (mounted) {
          setUser(null);
          setSession(null);
          setError(null);
        }
        router.push("/auth");
      }
    } catch (err) {
      console.error("Error signing out:", err);
      if (mounted) {
        setError("Failed to sign out");
        setLoading(false);
      }
    }
  };

  // Prevent hydration mismatch by showing loading until mounted
  if (!mounted) {
    return (
      <AuthContext.Provider
        value={{
          user: null,
          session: null,
          loading: true,
          error: null,
          signOut,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
