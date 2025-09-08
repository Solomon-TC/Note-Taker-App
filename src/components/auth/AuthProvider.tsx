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
  isPro: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  error: null,
  isNewUser: false,
  isPro: false,
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
  const [isPro, setIsPro] = useState(false);
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

        // Step 3: Check if user needs onboarding and pro status (only if we have a user)
        if (session?.user) {
          console.log("🔐 AuthProvider: Checking user status...");
          try {
            // Check onboarding status
            const { data: notebooks, error: notebooksError } = await supabase
              .from("notebooks")
              .select("id")
              .eq("user_id", session.user.id)
              .limit(1);

            // Check pro status - ensure user exists in users table
            let { data: userData, error: userError } = await supabase
              .from("users")
              .select("is_pro, stripe_customer_id, plan, current_period_end")
              .eq("id", session.user.id)
              .single();

            // If user doesn't exist in users table, create them
            if (userError && userError.code === "PGRST116") {
              console.log(
                "🔐 AuthProvider: Creating user record in users table",
              );
              const { data: newUser, error: createError } = await supabase
                .from("users")
                .insert({
                  id: session.user.id,
                  email: session.user.email || "",
                  full_name: session.user.user_metadata?.full_name || null,
                  avatar_url: session.user.user_metadata?.avatar_url || null,
                  is_pro: false,
                  plan: null,
                  current_period_end: null,
                  stripe_customer_id: null,
                })
                .select("is_pro, stripe_customer_id, plan, current_period_end")
                .single();

              if (!createError && newUser) {
                userData = newUser;
              } else {
                // Default to non-pro if creation fails
                userData = {
                  is_pro: false,
                  stripe_customer_id: null,
                  plan: null,
                  current_period_end: null,
                };
              }
            } else if (userError) {
              // Default to non-pro for any other error
              userData = {
                is_pro: false,
                stripe_customer_id: null,
                plan: null,
                current_period_end: null,
              };
            }

            if (isMounted) {
              const hasNotebooks = notebooks && notebooks.length > 0;
              const userIsPro = userData?.is_pro || false;

              safeSetState(() => {
                setIsNewUser(!hasNotebooks);
                setIsPro(userIsPro);
              });

              console.log("🔐 AuthProvider: User status check:", {
                hasNotebooks,
                isNewUser: !hasNotebooks,
                isPro: userIsPro,
                notebooksError: notebooksError?.message,
                userError: userError?.message,
              });
            }
          } catch (err) {
            console.error("🔐 AuthProvider: Error checking user status:", err);
            safeSetState(() => {
              setIsNewUser(false);
              setIsPro(false);
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

          // Handle user status check on sign in (without timeout)
          if (
            newSession?.user &&
            (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
          ) {
            try {
              // Check onboarding status
              const { data: notebooks, error: notebooksError } = await supabase
                .from("notebooks")
                .select("id")
                .eq("user_id", newSession.user.id)
                .limit(1);

              // Check pro status - ensure user exists in users table
              let { data: userData, error: userError } = await supabase
                .from("users")
                .select("is_pro, stripe_customer_id, plan, current_period_end")
                .eq("id", newSession.user.id)
                .single();

              // If user doesn't exist in users table, create them
              if (userError && userError.code === "PGRST116") {
                console.log(
                  "🔐 AuthProvider: Creating user record in users table on auth change",
                );
                const { data: newUser, error: createError } = await supabase
                  .from("users")
                  .insert({
                    id: newSession.user.id,
                    email: newSession.user.email || "",
                    full_name: newSession.user.user_metadata?.full_name || null,
                    avatar_url:
                      newSession.user.user_metadata?.avatar_url || null,
                    is_pro: false,
                    plan: null,
                    current_period_end: null,
                    stripe_customer_id: null,
                  })
                  .select(
                    "is_pro, stripe_customer_id, plan, current_period_end",
                  )
                  .single();

                if (!createError && newUser) {
                  userData = newUser;
                } else {
                  // Default to non-pro if creation fails
                  userData = {
                    is_pro: false,
                    stripe_customer_id: null,
                    plan: null,
                    current_period_end: null,
                  };
                }
              } else if (userError) {
                // Default to non-pro for any other error
                userData = {
                  is_pro: false,
                  stripe_customer_id: null,
                  plan: null,
                  current_period_end: null,
                };
              }

              if (isMounted) {
                const hasNotebooks = notebooks && notebooks.length > 0;
                const userIsPro = userData?.is_pro || false;

                safeSetState(() => {
                  setIsNewUser(!hasNotebooks);
                  setIsPro(userIsPro);
                });

                console.log("🔐 AuthProvider: Auth change user status check:", {
                  hasNotebooks,
                  isNewUser: !hasNotebooks,
                  isPro: userIsPro,
                  notebooksError: notebooksError?.message,
                  userError: userError?.message,
                });
              }
            } catch (err) {
              console.error(
                "🔐 AuthProvider: Error checking user status on auth change:",
                err,
              );
              safeSetState(() => {
                setIsNewUser(false);
                setIsPro(false);
              });
            }
          } else if (event === "SIGNED_OUT") {
            safeSetState(() => {
              setIsNewUser(false);
              setIsPro(false);
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
          isPro: false,
          signOut,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, error, isNewUser, isPro, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
