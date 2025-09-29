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
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  
  // Memoize supabase client to prevent recreation
  const supabase = useMemo(() => createClient(), []);

  // Handle page visibility changes to maintain session continuity
  const handleVisibilityChange = useCallback(async () => {
    if (!mountedRef.current) return;
    
    // When page becomes visible again, refresh the session
    if (document.visibilityState === 'visible') {
      console.log('🔄 AuthProvider: Page became visible, refreshing session');
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mountedRef.current) return;
        
        if (sessionError) {
          console.error('🔄 AuthProvider: Session refresh error:', sessionError);
          // Handle session errors gracefully
          if (sessionError.message.includes('issued in the future')) {
            console.warn('🔄 AuthProvider: Session time skew detected, clearing session');
            await supabase.auth.signOut();
            setUser(null);
            setIsPro(false);
            setError(null);
          } else {
            setError(sessionError.message);
          }
        } else if (session?.user) {
          // Session is valid, update user state if needed
          if (!user || user.id !== session.user.id) {
            console.log('🔄 AuthProvider: Updating user from session refresh');
            setUser(session.user);
            setError(null);
            
            // Refresh pro status
            try {
              const { data: userData } = await supabase
                .from("users")
                .select("is_pro")
                .eq("id", session.user.id)
                .single();
              
              if (userData && mountedRef.current) {
                setIsPro(userData.is_pro || false);
              }
            } catch (err) {
              console.error('🔄 AuthProvider: Error refreshing pro status:', err);
            }
          }
        } else if (user) {
          // No session but we have a user - sign out
          console.log('🔄 AuthProvider: No session found, signing out');
          setUser(null);
          setIsPro(false);
          setError(null);
        }
      } catch (err) {
        console.error('🔄 AuthProvider: Error during visibility change handling:', err);
      }
    }
  }, [supabase, user]);

  // Set up page visibility listener
  useEffect(() => {
    if (typeof document !== 'undefined') {
      visibilityHandlerRef.current = handleVisibilityChange;
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        if (visibilityHandlerRef.current) {
          document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
          visibilityHandlerRef.current = null;
        }
      };
    }
  }, [handleVisibilityChange]);

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

    console.log('🔐 AuthProvider: Auth state change:', event, !!session);

    try {
      setUser(session?.user ?? null);
      setError(null);
      
      // Check pro status if user exists
      if (session?.user) {
        // Check pro status - ensure user exists in users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("is_pro, stripe_customer_id, plan, current_period_end")
          .eq("id", session.user.id)
          .single();

        // If user doesn't exist in users table, create them
        if (userError && userError.code === "PGRST116") {
          console.log(
            "🔐 AuthProvider: Creating user record in users table on auth change",
          );
          const { data: newUser, error: createError } = await supabase
            .from("users")
            .insert({
              id: session.user.id,
              email: session.user.email || "",
              full_name: session.user.user_metadata?.full_name || null,
              avatar_url:
                session.user.user_metadata?.avatar_url || null,
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
            setIsPro(newUser.is_pro || false);
          } else {
            setIsPro(false);
          }
        } else if (!userError && userData) {
          setIsPro(userData.is_pro || false);
        } else {
          setIsPro(false);
        }
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
  }, [supabase]);

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
            // Check pro status - ensure user exists in users table
            const { data: userData, error: userError } = await supabase
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
                setIsPro(newUser.is_pro || false);
              } else {
                setIsPro(false);
              }
            } else if (!userError && userData) {
              setIsPro(userData.is_pro || false);
            } else {
              setIsPro(false);
            }
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
      // Clear any stored state before signing out
      if (typeof window !== 'undefined') {
        localStorage.removeItem('scribly_dashboard_state');
      }
      
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