"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase-client";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

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
  
  // Use refs to prevent infinite re-renders
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  
  // Memoize supabase client to prevent recreation
  const supabase = useMemo(() => createClient(), []);

  // Memoize checkProStatus to prevent recreation
  const checkProStatus = useCallback(async (userId: string) => {
    if (!mountedRef.current) return;
    
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("is_pro")
        .eq("id", userId)
        .single();

      if (!mountedRef.current) return;

      if (userError) {
        console.error("Error fetching user pro status:", userError);
        setIsPro(false);
      } else {
        setIsPro(userData?.is_pro || false);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("Error checking pro status:", err);
      setIsPro(false);
    }
  }, [supabase]);

  // Handle auth state changes
  const handleAuthStateChange = useCallback(async (event: AuthChangeEvent, session: Session | null) => {
    if (!mountedRef.current) return;

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
      if (!mountedRef.current) return;
      console.error("Auth state change error:", err);
      setError(err instanceof Error ? err.message : "Authentication failed");
      setIsPro(false);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [checkProStatus]);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializingRef.current) return;
    initializingRef.current = true;

    let authSubscription: { unsubscribe: () => void } | null = null;

    // Get initial session with error handling
    const getInitialSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!mountedRef.current) return;

        if (sessionError) {
          // Handle session time skew errors gracefully
          if (sessionError.message.includes('issued in the future')) {
            console.warn('Session time skew detected, clearing session');
            await supabase.auth.signOut();
            setUser(null);
            setIsPro(false);
            setError(null);
          } else {
            console.error("Auth session error:", sessionError);
            setError(sessionError.message);
            setUser(null);
            setIsPro(false);
          }
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
        if (!mountedRef.current) return;
        console.error("Auth initialization error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setUser(null);
        setIsPro(false);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const setupAuthListener = () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);
      authSubscription = subscription;
    };

    // Initialize auth
    getInitialSession().then(() => {
      if (mountedRef.current) {
        setupAuthListener();
      }
    });

    return () => {
      mountedRef.current = false;
      initializingRef.current = false;
      authSubscription?.unsubscribe();
    };
  }, []); // Empty dependency array to prevent re-initialization

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setError(null);
      setIsPro(false);
    } catch (err) {
      console.error("Sign out error:", err);
      setError(err instanceof Error ? err.message : "Sign out failed");
    }
  }, [supabase]);

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