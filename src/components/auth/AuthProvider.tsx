"use client";

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isPro: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  
  // Memoize supabase client to prevent recreation
  const supabase = useMemo(() => createClient(), []);
  
  // Use direct type casting to bypass Supabase type inference issues
  const supabaseTyped = supabase as any;

  // Memoize checkProStatus to prevent recreation
  const checkProStatus = useCallback(async (userId: string) => {
    try {
      const { data: userData, error: userError } = await supabaseTyped
        .from("users")
        .select("is_pro")
        .eq("id", userId)
        .single();

      if (userError) {
        console.error("Error fetching user pro status:", userError);
        setIsPro(false);
      } else {
        setIsPro(userData?.is_pro || false);
      }
    } catch (err) {
      console.error("Error checking pro status:", err);
      setIsPro(false);
    }
  }, [supabaseTyped]);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabaseTyped.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error("Auth session error:", sessionError);
          setError(sessionError.message);
          setUser(null);
          setIsPro(false);
        } else {
          setUser(session?.user ?? null);
          setError(null);
          
          // Check pro status if user exists
          if (session?.user) {
            await checkProStatus(session.user.id);
          } else {
            setIsPro(false);
          }
        }
      } catch (err) {
        if (!mounted) return;
        console.error("Auth initialization error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setUser(null);
        setIsPro(false);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseTyped.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      try {
        setUser(session?.user ?? null);
        setError(null);
        
        // Check pro status if user exists
        if (session?.user) {
          await checkProStatus(session.user.id);
        } else {
          setIsPro(false);
        }
      } catch (err) {
        if (!mounted) return;
        console.error("Auth state change error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setIsPro(false);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabaseTyped, checkProStatus]);

  const signOut = useCallback(async () => {
    try {
      await supabaseTyped.auth.signOut();
      setError(null);
      setIsPro(false);
    } catch (err) {
      console.error("Sign out error:", err);
      setError(err instanceof Error ? err.message : "Sign out failed");
    }
  }, [supabaseTyped]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    isPro,
    signOut
  }), [user, loading, error, isPro, signOut]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}