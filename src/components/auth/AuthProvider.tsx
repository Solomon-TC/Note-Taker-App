"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

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
        console.error("Auth initialization error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setUser(null);
        setIsPro(false);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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
        console.error("Auth state change error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setIsPro(false);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const checkProStatus = async (userId: string) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("is_pro")
        .eq("id", userId)
        .single();

      if (userError) {
        console.error("Error fetching user pro status:", userError);
        // Default to false if we can't fetch the status
        setIsPro(false);
      } else {
        setIsPro(userData?.is_pro || false);
      }
    } catch (err) {
      console.error("Error checking pro status:", err);
      setIsPro(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setError(null);
      setIsPro(false);
    } catch (err) {
      console.error("Sign out error:", err);
      setError(err instanceof Error ? err.message : "Sign out failed");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, isPro, signOut }}>
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