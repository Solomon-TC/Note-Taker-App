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

    const initializeAuth = async () => {
      try {
        supabase = createClient();

        // Get initial session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!authMounted) return;

        if (sessionError) {
          console.error("Session error:", sessionError);
          setError(sessionError.message);
        } else {
          setSession(session);
          setUser(session?.user ?? null);

          // Create user record if needed (don't wait for this)
          if (session?.user) {
            createUserRecord(supabase, session.user).catch(console.error);
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        if (authMounted) {
          setError("Failed to initialize authentication");
        }
      } finally {
        if (authMounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state change listener
    const setupAuthListener = () => {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!authMounted) return;

        console.log("Auth state change:", event);

        setSession(session);
        setUser(session?.user ?? null);
        setError(null);

        // Create user record if needed (don't wait for this)
        if (
          session?.user &&
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
        ) {
          createUserRecord(supabase, session.user).catch(console.error);
        }
      });

      return subscription;
    };

    initializeAuth().then(() => {
      if (authMounted) {
        setupAuthListener();
      }
    });

    return () => {
      authMounted = false;
    };
  }, [mounted]);

  // Helper function to create user record (non-blocking)
  const createUserRecord = async (
    supabase: ReturnType<typeof createClient>,
    user: User,
  ) => {
    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingUser) {
        await supabase.from("users").insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        });
      }
    } catch (error) {
      console.error("Error handling user record:", error);
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
