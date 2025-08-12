"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/types/supabase";

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables:", {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey,
      origin: typeof window !== "undefined" ? window.location.origin : "server",
    });
    throw new Error(
      "Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required",
    );
  }

  try {
    // Always create a fresh client for serverless environments
    const client = createClientComponentClient<Database>();
    console.log("Supabase client created successfully", {
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey,
      origin: typeof window !== "undefined" ? window.location.origin : "server",
    });
    return client;
  } catch (error) {
    console.error("Failed to create Supabase client:", error);
    throw error;
  }
};
