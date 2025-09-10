import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Database } from "@/types/supabase";

// Environment variable validation
function validateEnvironmentVariables() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('🚨 Missing required environment variables:', missing);
    return false;
  }
  
  return true;
}

// Define route patterns
const publicRoutes = ["/", "/auth"];
const authRequiredRoutes = [
  "/dashboard",
  "/onboarding", 
  "/paywall",
  "/friends",
  "/feedback",
];

export async function middleware(req: NextRequest) {
  // Skip middleware during build time or when environment is not ready
  if (process.env.NODE_ENV === 'production' && 
      (!process.env.VERCEL_URL || process.env.VERCEL_BUILDER)) {
    return NextResponse.next();
  }

  // Validate environment variables first
  if (!validateEnvironmentVariables()) {
    console.error('🚨 Middleware: Environment validation failed');
    // In build mode, allow request to proceed
    if (process.env.VERCEL_BUILDER) {
      return NextResponse.next();
    }
    return new NextResponse('Configuration Error', { status: 500 });
  }

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  try {
    const supabase = createSupabaseServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            req.cookies.set({
              name,
              value,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: req.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            req.cookies.set({
              name,
              value: "",
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: req.headers,
              },
            });
            response.cookies.set({
              name,
              value: "",
              ...options,
            });
          },
        },
      }
    );

    const { pathname, search } = req.nextUrl;
    const fullPath = pathname + search;

    console.log(`🛡️ Middleware: Processing request for ${fullPath}`);

    // Allow public routes
    if (publicRoutes.includes(pathname)) {
      console.log(`🛡️ Middleware: Public route ${pathname}, allowing access`);
      return response;
    }

    // Allow API routes and static files
    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon.ico") ||
      pathname.includes(".")
    ) {
      return response;
    }

    // CRITICAL FIX: Allow paywall with checkout success/cancelled query params
    if (pathname === "/paywall" && (search.includes("checkout=success") || search.includes("checkout=cancelled"))) {
      console.log(`🛡️ Middleware: Allowing paywall checkout flow: ${fullPath}`);
      return response;
    }

    // Get the current session with reduced timeout to prevent infinite loops
    let session = null;
    let sessionError = null;

    try {
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 2000) // Reduced timeout
      );

      const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
      session = result.data?.session;
      sessionError = result.error;
    } catch (error) {
      console.error(`🛡️ Middleware: Session timeout for ${pathname}`);
      // On timeout, allow request to proceed - page-level auth will handle it
      return response;
    }

    console.log(`🛡️ Middleware: Session check for ${pathname}:`, {
      hasSession: !!session,
      userId: session?.user?.id,
      error: sessionError?.message,
    });

    // If no session and route requires auth, redirect to auth
    if (
      !session &&
      authRequiredRoutes.some((route) => pathname.startsWith(route))
    ) {
      console.log(
        `🛡️ Middleware: No session for protected route ${pathname}, redirecting to /auth`,
      );
      const redirectUrl = new URL("/auth", req.url);
      return NextResponse.redirect(redirectUrl);
    }

    // If we have a session, check user status with reduced complexity
    if (session?.user) {
      console.log(`🛡️ Middleware: Checking user status for ${pathname}`);

      // Get user data with reduced timeout
      let userData = null;
      let userError = null;

      try {
        const userDataPromise = supabase
          .from("users")
          .select("is_pro")
          .eq("id", session.user.id)
          .single();

        const userTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('User data timeout')), 1500) // Reduced timeout
        );

        const result = await Promise.race([userDataPromise, userTimeoutPromise]) as any;
        userData = result.data;
        userError = result.error;
      } catch (error) {
        console.error(`🛡️ Middleware: Timeout fetching user data for ${pathname}`);
        // On timeout, allow request to proceed
        return response;
      }

      if (userError && userError.code === "PGRST116") {
        // User doesn't exist, just set as non-pro and continue
        // Don't try to create user in middleware to avoid type issues
        userData = { is_pro: false };
      } else if (userError) {
        userData = { is_pro: false };
      }

      const isPro = userData?.is_pro || false;

      // Simplified routing logic to prevent infinite loops
      if (!isPro && pathname === "/dashboard") {
        console.log(`🛡️ Middleware: Non-pro user accessing dashboard, redirecting to /paywall`);
        const redirectUrl = new URL("/paywall", req.url);
        return NextResponse.redirect(redirectUrl);
      }

      if (isPro && pathname === "/paywall" && !search.includes("checkout=")) {
        console.log(`🛡️ Middleware: Pro user accessing paywall, redirecting to /dashboard`);
        const redirectUrl = new URL("/dashboard", req.url);
        return NextResponse.redirect(redirectUrl);
      }
    }

    console.log(`🛡️ Middleware: Allowing access to ${fullPath}`);
    return response;
  } catch (error) {
    console.error(
      `🛡️ Middleware: Error processing request for ${req.nextUrl.pathname}:`,
      error,
    );
    // On error, allow the request to proceed to prevent infinite loops
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};