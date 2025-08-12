"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/types/supabase";

// Create a singleton instance to prevent multiple clients
let supabaseClient: ReturnType<
  typeof createClientComponentClient<Database>
> | null = null;

export const createClient = () => {
  // Return existing client if available
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables:", {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey,
    });
    throw new Error(
      "Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required",
    );
  }

  try {
    supabaseClient = createClientComponentClient<Database>();
    return supabaseClient;
  } catch (error) {
    console.error("Failed to create Supabase client:", error);
    throw error;
  }
};
