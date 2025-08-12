"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";
import { Database } from "@/types/supabase";

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
  const initialized = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    // Prevent multiple initializations
    if (initialized.current) return;
    initialized.current = true;

    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
      supabaseRef.current = supabase;
      console.log("AuthProvider: Supabase client initialized");
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
      setError("Failed to initialize authentication");
      setLoading(false);
      return;
    }

    // Set a timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      console.warn("Authentication initialization timeout");
      setLoading(false);
      if (!user && !session) {
        console.log("No session found after timeout, continuing without auth");
      }
    }, 8000); // 8 second timeout

    const getSession = async () => {
      try {
        console.log("Getting initial session...");
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          // Don't set error for session issues, just log them
          console.log(
            "Continuing without session due to error:",
            sessionError.message,
          );
        } else {
          console.log("Initial session:", session ? "Found" : "None");
          if (session) {
            console.log("Session details:", {
              userId: session.user?.id,
              email: session.user?.email,
              expiresAt: session.expires_at,
            });
          }
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (err) {
        console.error("Error getting session:", err);
        // Don't set error state, just continue without session
        console.log("Continuing without session due to error");
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setLoading(false);
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "Auth state change:",
        event,
        session ? "Session exists" : "No session",
        session
          ? { userId: session.user?.id, email: session.user?.email }
          : null,
      );

      try {
        setSession(session);
        setUser(session?.user ?? null);
        setError(null); // Clear any previous errors
        setLoading(false);

        // Create user record in public.users table if it doesn't exist
        if (
          session?.user &&
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
        ) {
          console.log("Creating/checking user record for event:", event);
          try {
            const { data: existingUser, error: selectError } = await supabase
              .from("users")
              .select("id")
              .eq("id", session.user.id)
              .single();

            if (selectError && selectError.code !== "PGRST116") {
              console.error("Error checking existing user:", selectError);
            }

            if (!existingUser) {
              console.log("Creating new user record...");
              const { error: insertError } = await supabase
                .from("users")
                .insert({
                  id: session.user.id,
                  email: session.user.email!,
                  full_name: session.user.user_metadata?.full_name || null,
                  avatar_url: session.user.user_metadata?.avatar_url || null,
                });

              if (insertError) {
                console.error("Error creating user record:", insertError);
              } else {
                console.log("User record created successfully");
              }
            } else {
              console.log("User record already exists");
            }
          } catch (userError) {
            console.error("Error handling user record:", userError);
            // Don't set error state for user record issues as auth still works
          }
        }
      } catch (err) {
        console.error("Error in auth state change:", err);
        // Don't set error state for auth state changes
        setLoading(false);
      }
    });

    return () => {
      console.log("Cleaning up auth subscription...");
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const signOut = async () => {
    try {
      const supabase = supabaseRef.current || createClient();
      console.log("Signing out user...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        setError(error.message);
      } else {
        console.log("Sign out successful");
        // Force redirect to auth page
        window.location.href = "/auth";
      }
    } catch (err) {
      console.error("Error signing out:", err);
      setError("Failed to sign out");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
