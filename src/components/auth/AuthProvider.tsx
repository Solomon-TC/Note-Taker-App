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
  isNewUser: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  error: null,
  isNewUser: false,
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
  const [isNewUser, setIsNewUser] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    let subscription: any;
    const supabase = createClient();

    // Helper function to safely update state
    const safeSetState = (updateFn: () => void) => {
      if (isMounted) {
        updateFn();
      }
    };

    const initializeAuth = async () => {
      try {
        console.log("🔐 AuthProvider: Starting initialization...");

        // Step 1: Get initial session
        console.log("🔐 AuthProvider: Getting initial session...");
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!isMounted) {
          console.log(
            "🔐 AuthProvider: Component unmounted during session fetch",
          );
          return;
        }

        console.log("🔐 AuthProvider: Initial session:", {
          hasSession: !!session,
          userId: session?.user?.id,
          error: sessionError?.message,
        });

        // Step 2: Set initial auth state
        safeSetState(() => {
          setSession(session);
          setUser(session?.user ?? null);
          setError(sessionError?.message || null);
        });

        // Step 3: Check if user needs onboarding (only if we have a user)
        if (session?.user) {
          console.log("🔐 AuthProvider: Checking onboarding status...");
          try {
            const { data: notebooks, error: notebooksError } = await supabase
              .from("notebooks")
              .select("id")
              .eq("user_id", session.user.id)
              .limit(1);

            if (isMounted) {
              const hasNotebooks = notebooks && notebooks.length > 0;
              safeSetState(() => {
                setIsNewUser(!hasNotebooks);
              });
              console.log("🔐 AuthProvider: Onboarding check:", {
                hasNotebooks,
                isNewUser: !hasNotebooks,
                error: notebooksError?.message,
              });
            }
          } catch (err) {
            console.error(
              "🔐 AuthProvider: Error checking onboarding status:",
              err,
            );
            safeSetState(() => {
              setIsNewUser(false);
            });
          }
        }

        // Step 4: Set up auth state listener
        console.log("🔐 AuthProvider: Setting up auth state listener...");
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (!isMounted) return;

          console.log("🔐 AuthProvider: Auth state change:", {
            event,
            hasSession: !!newSession,
            userId: newSession?.user?.id,
          });

          safeSetState(() => {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setError(null);
          });

          // Handle new user check on sign in (without timeout)
          if (
            newSession?.user &&
            (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
          ) {
            try {
              const { data: notebooks, error: notebooksError } = await supabase
                .from("notebooks")
                .select("id")
                .eq("user_id", newSession.user.id)
                .limit(1);

              if (isMounted) {
                const hasNotebooks = notebooks && notebooks.length > 0;
                safeSetState(() => {
                  setIsNewUser(!hasNotebooks);
                });
                console.log("🔐 AuthProvider: Auth change onboarding check:", {
                  hasNotebooks,
                  isNewUser: !hasNotebooks,
                  error: notebooksError?.message,
                });
              }
            } catch (err) {
              console.error(
                "🔐 AuthProvider: Error checking new user status on auth change:",
                err,
              );
              safeSetState(() => {
                setIsNewUser(false);
              });
            }
          } else if (event === "SIGNED_OUT") {
            safeSetState(() => {
              setIsNewUser(false);
            });
          }
        });

        subscription = authSubscription;
        console.log("🔐 AuthProvider: Auth state listener set up");

        // Step 5: Mark as initialized and stop loading
        if (isMounted) {
          safeSetState(() => {
            setInitialized(true);
            setLoading(false);
          });
          console.log("🔐 AuthProvider: Initialization complete!");
        }
      } catch (err) {
        console.error("🔐 AuthProvider: Initialization error:", err);
        if (isMounted) {
          safeSetState(() => {
            setError(
              err instanceof Error
                ? err.message
                : "Failed to initialize authentication",
            );
            setLoading(false);
            setInitialized(true);
          });
        }
      }
    };

    // Start initialization
    initializeAuth();

    return () => {
      console.log("🔐 AuthProvider: Cleanup - Component unmounting");
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("🔐 AuthProvider: Sign out error:", error);
        setError(error.message);
        setLoading(false);
      } else {
        // State will be cleared by the auth state change listener
        router.push("/auth");
      }
    } catch (err) {
      console.error("🔐 AuthProvider: Sign out error:", err);
      setError("Failed to sign out");
      setLoading(false);
    }
  };

  // Show loading until initialized
  if (!initialized) {
    return (
      <AuthContext.Provider
        value={{
          user: null,
          session: null,
          loading: true,
          error: null,
          isNewUser: false,
          signOut,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, error, isNewUser, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
