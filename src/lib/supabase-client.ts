"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

// Singleton pattern to prevent multiple client instances
let supabaseInstance: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createClient() {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance;
  }

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
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: () => Promise.resolve({ error: null }),
      },
    } as any;
  }

  // Create the singleton instance with enhanced configuration for session management
  supabaseInstance = createSupabaseClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        // CRITICAL: Enable automatic token refresh
        autoRefreshToken: true,
        // Persist session across page reloads
        persistSession: true,
        // Detect session in URL (for OAuth flows)
        detectSessionInUrl: true,
        // Use localStorage for session persistence
        storageKey: 'supabase.auth.token',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        // CRITICAL: Set flow type to handle token refresh properly
        flowType: 'pkce',
      },
      // Add retry logic for network issues
      global: {
        headers: {
          'X-Client-Info': 'supabase-js-web',
        },
      },
      // CRITICAL: Configure realtime to handle reconnections
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  );

  // Set up automatic session refresh monitoring
  if (typeof window !== 'undefined') {
    // Refresh session proactively every 30 minutes
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabaseInstance!.auth.getSession();
        
        if (error) {
          console.error('🔄 Session refresh check failed:', error);
          return;
        }
        
        if (session) {
          // Check if token is close to expiring (within 5 minutes)
          const expiresAt = session.expires_at;
          if (expiresAt) {
            const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
            
            if (expiresIn < 300) { // Less than 5 minutes
              console.log('🔄 Token expiring soon, refreshing proactively');
              const { error: refreshError } = await supabaseInstance!.auth.refreshSession();
              
              if (refreshError) {
                console.error('🔄 Proactive session refresh failed:', refreshError);
              } else {
                console.log('✅ Session refreshed proactively');
              }
            }
          }
        }
      } catch (err) {
        console.error('🔄 Error in session refresh interval:', err);
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    // Clean up interval on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(refreshInterval);
    });
  }

  return supabaseInstance;
}

// Reset function for testing or when needed
export function resetSupabaseClient() {
  supabaseInstance = null;
}

/**
 * Validate and refresh session if needed
 * Returns true if session is valid, false otherwise
 */
export async function validateSession(): Promise<boolean> {
  const supabase = createClient();
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Session validation error:', error);
      return false;
    }
    
    if (!session) {
      console.warn('⚠️ No active session found');
      return false;
    }
    
    // Check if token is expired or expiring soon
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
      
      // If token expires in less than 1 minute, refresh it
      if (expiresIn < 60) {
        console.log('🔄 Token expiring, refreshing session');
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('❌ Session refresh failed:', refreshError);
          return false;
        }
        
        if (!newSession) {
          console.error('❌ Session refresh returned no session');
          return false;
        }
        
        console.log('✅ Session refreshed successfully');
        return true;
      }
    }
    
    return true;
  } catch (err) {
    console.error('❌ Session validation error:', err);
    return false;
  }
}

/**
 * Execute a database operation with automatic session validation and retry
 */
export async function withSessionValidation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 1
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Validate session before operation
      const isValid = await validateSession();
      
      if (!isValid && attempt === 0) {
        console.warn('⚠️ Session invalid, attempting refresh before operation');
        const supabase = createClient();
        await supabase.auth.refreshSession();
      }
      
      // Execute the operation
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is auth-related
      const isAuthError = 
        error?.message?.includes('JWT') ||
        error?.message?.includes('session') ||
        error?.message?.includes('auth') ||
        error?.code === 'PGRST301';
      
      if (isAuthError && attempt < maxRetries) {
        console.warn(`⚠️ Auth error detected, refreshing session (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        // Try to refresh session
        const supabase = createClient();
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('❌ Session refresh failed:', refreshError);
          throw error;
        }
        
        console.log('✅ Session refreshed, retrying operation');
        // Continue to next iteration to retry
        continue;
      }
      
      // If not auth error or max retries reached, throw
      throw error;
    }
  }
  
  throw lastError;
}