import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Database } from "@/types/supabase";

// Define route patterns
const publicRoutes = ["/", "/auth"];
const authRequiredRoutes = [
  "/dashboard",
  "/onboarding", 
  "/paywall",
  "/friends",
  "/feedback",
];
const proRequiredRoutes = [
  "/dashboard",
  "/friends",
  "/feedback",
  "/onboarding",
];

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

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

  try {
    // Get the current session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

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

    // If we have a session, check user status
    if (session?.user) {
      console.log(`🛡️ Middleware: Checking user status for ${pathname}`);

      // Get user data from the database
      const { data: fetchedUserData, error: userError } = await supabase
        .from("users")
        .select("is_pro, stripe_customer_id, plan, current_period_end")
        .eq("id", session.user.id)
        .single();

      let userData = fetchedUserData;

      if (userError) {
        console.error(`🛡️ Middleware: Error fetching user data:`, userError);

        // If user doesn't exist in users table, create them and treat as non-pro
        if (userError.code === "PGRST116") {
          console.log(
            `🛡️ Middleware: User not found in users table, creating record`,
          );
          const { error: createError } = await supabase.from("users").insert({
            id: session.user.id,
            email: session.user.email || "",
            full_name: session.user.user_metadata?.full_name || null,
            avatar_url: session.user.user_metadata?.avatar_url || null,
            is_pro: false,
            plan: null,
            current_period_end: null,
            stripe_customer_id: null,
          });

          if (!createError) {
            // Treat as non-pro user
            userData = {
              is_pro: false,
              stripe_customer_id: null,
              plan: null,
              current_period_end: null,
            };
          } else {
            console.error(
              `🛡️ Middleware: Error creating user record:`,
              createError,
            );
            // Default to non-pro if we can't create the record
            userData = {
              is_pro: false,
              stripe_customer_id: null,
              plan: null,
              current_period_end: null,
            };
          }
        } else {
          // For other errors, default to non-pro to be safe
          userData = {
            is_pro: false,
            stripe_customer_id: null,
            plan: null,
            current_period_end: null,
          };
        }
      }

      // Check if user has completed onboarding (has notebooks)
      const { data: notebooks, error: notebooksError } = await supabase
        .from("notebooks")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1);

      const hasCompletedOnboarding = notebooks && notebooks.length > 0;
      const isPro = userData?.is_pro || false;

      console.log(`🛡️ Middleware: User status:`, {
        hasCompletedOnboarding,
        isPro,
        pathname,
        search,
        notebooksError: notebooksError?.message,
      });

      // FLOW IMPLEMENTATION:
      // New user: signup → onboarding → paywall → dashboard
      // Existing pro user: dashboard
      // Existing non-pro user: paywall → dashboard

      // 1. NEW USERS (haven't completed onboarding)
      if (!hasCompletedOnboarding) {
        // New users should go to onboarding first, regardless of pro status
        if (pathname !== "/onboarding") {
          console.log(
            `🛡️ Middleware: New user accessing ${pathname}, redirecting to /onboarding`,
          );
          const redirectUrl = new URL("/onboarding", req.url);
          return NextResponse.redirect(redirectUrl);
        }
      }

      // 2. EXISTING USERS (have completed onboarding)
      if (hasCompletedOnboarding) {
        // Non-pro existing users should go to paywall (except if already there)
        if (!isPro && pathname !== "/paywall") {
          console.log(
            `🛡️ Middleware: Existing non-pro user accessing ${pathname}, redirecting to /paywall`,
          );
          // CRITICAL FIX: Preserve query parameters when redirecting
          const redirectUrl = new URL("/paywall", req.url);
          if (search) {
            redirectUrl.search = search;
          }
          return NextResponse.redirect(redirectUrl);
        }

        // Pro users who completed onboarding shouldn't access onboarding or paywall
        if (isPro && pathname === "/onboarding") {
          console.log(
            `🛡️ Middleware: Pro user already onboarded, redirecting from /onboarding to /dashboard`,
          );
          const redirectUrl = new URL("/dashboard", req.url);
          return NextResponse.redirect(redirectUrl);
        }

        if (isPro && pathname === "/paywall") {
          console.log(
            `🛡️ Middleware: Pro user accessing paywall, redirecting to /dashboard`,
          );
          const redirectUrl = new URL("/dashboard", req.url);
          return NextResponse.redirect(redirectUrl);
        }
      }
    }

    console.log(`🛡️ Middleware: Allowing access to ${fullPath}`);
    return response;
  } catch (error) {
    console.error(
      `🛡️ Middleware: Error processing request for ${pathname}:`,
      error,
    );
    // On error, allow the request to proceed
    // The page-level auth will handle any issues
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