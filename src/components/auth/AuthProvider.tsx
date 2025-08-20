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

          // Ensure user record exists for new sign-ins only
          if (session?.user && event === "SIGNED_IN") {
            console.log(
              "🔐 AuthProvider: Ensuring user record for new sign-in:",
              {
                userId: session.user.id,
                provider: session.user.app_metadata?.provider,
              },
            );
            // Don't await - run in background
            ensureUserRecord(supabase, session.user).catch((error) => {
              console.warn(
                "🔐 AuthProvider: Background user record creation failed:",
                error,
              );
            });
          }
        });

        subscription = authSubscription;

        // Ensure user record exists for existing session
        if (session?.user) {
          console.log(
            "🔐 AuthProvider: Ensuring user record exists for existing session:",
            {
              userId: session.user.id,
              email: session.user.email,
              provider: session.user.app_metadata?.provider,
            },
          );
          // Don't await - run in background
          ensureUserRecord(supabase, session.user).catch((error) => {
            console.warn(
              "🔐 AuthProvider: Background user record creation failed:",
              error,
            );
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

  // Simplified helper function to ensure user record exists
  const ensureUserRecord = async (
    supabase: ReturnType<typeof createClient>,
    user: User,
  ) => {
    try {
      console.log("🔐 AuthProvider: Ensuring user record exists for:", {
        id: user.id,
        email: user.email,
        provider: user.app_metadata?.provider,
      });

      // Simple check for existing user - no retries to prevent loops
      const { data: existingUser, error: selectError } = await supabase
        .from("users")
        .select("id, email, full_name, avatar_url")
        .eq("id", user.id)
        .single();

      // If there's a critical error, don't retry - just log and continue
      if (selectError && selectError.code !== "PGRST116") {
        console.warn(
          "🔐 AuthProvider: Database error checking user:",
          selectError.message,
        );
        return; // Don't throw, just continue
      }

      // Prepare user data with simple fallbacks
      const userData = {
        id: user.id,
        email: user.email!,
        full_name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.display_name ||
          (user.email ? user.email.split("@")[0] : null) ||
          null,
        avatar_url:
          user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      };

      if (!existingUser) {
        // Simple user creation - single attempt only
        console.log("🔐 AuthProvider: Creating new user record");
        const { error: insertError } = await supabase
          .from("users")
          .insert(userData);

        if (insertError) {
          // If it's a duplicate key error, that's fine (race condition)
          if (insertError.code === "23505") {
            console.log(
              "🔐 AuthProvider: User already exists (race condition)",
            );
          } else {
            console.warn(
              "🔐 AuthProvider: Failed to create user record:",
              insertError.message,
            );
          }
        } else {
          console.log("🔐 AuthProvider: Successfully created user record");
        }
      } else {
        console.log("🔐 AuthProvider: User record already exists");
      }
    } catch (error) {
      console.error("🔐 AuthProvider: Error ensuring user record:", error);
      // Don't throw - just log and continue to prevent infinite loops
    }
  };

  const signOut = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        setError(error.message);
      } else {
        router.push("/auth");
      }
    } catch (err) {
      console.error("Error signing out:", err);
      setError("Failed to sign out");
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
