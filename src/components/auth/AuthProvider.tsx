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

  useEffect(() => {
    // Prevent multiple initializations
    if (initialized.current) return;
    initialized.current = true;

    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
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
      setError("Authentication timeout - please refresh the page");
    }, 10000); // 10 second timeout

    const getSession = async () => {
      try {
        console.log("Getting initial session...");
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          setError(sessionError.message);
        } else {
          console.log("Initial session:", session ? "Found" : "None");
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (err) {
        console.error("Error getting session:", err);
        setError("Failed to get authentication session");
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
      );

      try {
        setSession(session);
        setUser(session?.user ?? null);
        setError(null); // Clear any previous errors
        setLoading(false);

        // Create user record in public.users table if it doesn't exist
        if (session?.user && event === "SIGNED_IN") {
          console.log("Creating/checking user record...");
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
            }
          } catch (userError) {
            console.error("Error handling user record:", userError);
            // Don't set error state for user record issues as auth still works
          }
        }
      } catch (err) {
        console.error("Error in auth state change:", err);
        setError("Authentication state error");
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
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        setError(error.message);
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
