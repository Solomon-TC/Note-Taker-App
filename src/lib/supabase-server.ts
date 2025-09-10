import { createServerClient } from "@supabase/ssr";
import { Database } from "@/types/supabase";

export function createClient() {
  // Get environment variables with fallbacks for build time
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  // During build time, return a mock client if env vars are missing
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase environment variables not available, using fallback');
    
    // Return a mock client for build time
    return {
      from: () => ({
        select: () => ({ data: null, error: new Error('Supabase not configured') }),
        insert: () => ({ data: null, error: new Error('Supabase not configured') }),
        update: () => ({ data: null, error: new Error('Supabase not configured') }),
        delete: () => ({ data: null, error: new Error('Supabase not configured') }),
      }),
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
      },
    } as any;
  }

  // Try to get cookies, but handle cases where it's not available
  let cookieStore: any = null;
  try {
    const { cookies } = require("next/headers");
    cookieStore = cookies();
  } catch (error) {
    console.warn('⚠️ Cookies not available in this context, using fallback');
    // Create a mock cookie store for contexts where cookies() is not available
    cookieStore = {
      getAll: () => [],
      set: () => {},
      get: () => undefined,
    };
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          try {
            return cookieStore.getAll();
          } catch {
            return [];
          }
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component
            // or cookies are not available in this context.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}