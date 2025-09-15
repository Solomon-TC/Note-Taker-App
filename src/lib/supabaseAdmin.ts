import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

// Check for required environment variables but don't throw immediately
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

// Only create the admin client if we have the required environment variables
if (SUPABASE_URL && SERVICE_ROLE_KEY) {
  try {
    supabaseAdmin = createClient<Database>(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
    console.log("✅ Supabase admin client initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Supabase admin client:", error);
    supabaseAdmin = null;
  }
} else {
  console.warn("⚠️ Supabase admin client not initialized: missing environment variables", {
    hasUrl: !!SUPABASE_URL,
    hasServiceKey: !!SERVICE_ROLE_KEY,
  });
}

// Helper function to check if admin client is available
export function isAdminClientAvailable(): boolean {
  return supabaseAdmin !== null;
}

// Helper function to get admin client with error handling
export function getAdminClient() {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase admin client is not available. Please ensure SUPABASE_SERVICE_ROLE_KEY is set in environment variables."
    );
  }
  return supabaseAdmin;
}

// Export the admin client (can be null)
export { supabaseAdmin };
export default supabaseAdmin;