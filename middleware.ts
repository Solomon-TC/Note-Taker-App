import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  // Define proper types for user data
  interface UserData {
    is_pro: boolean;
  }

  let userData: UserData | null = null;

  // Debug session information
  if (process.env.NODE_ENV === "development") {
    console.log("🔍 Middleware Debug Info:", {
      path: request.nextUrl.pathname,
      hasUser: !!user,
      userId: user?.id,
      error: sessionError?.message,
    });
  }

  // Protected routes that require authentication
  const protectedRoutes = [
    "/dashboard",
    "/notes",
    "/profile", 
    "/settings",
    "/friends",
    "/feedback",
  ];

  // Routes that should redirect authenticated users
  const authRoutes = ["/auth", "/login", "/signup"];

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  // Check if current path is an auth route
  const isAuthRoute = authRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  // If user is authenticated, fetch their profile data
  if (user) {
    try {
      const { data: userProfileData, error: userError } = await supabase
        .from("users")
        .select("is_pro")
        .eq("id", user.id)
        .single();

      // Handle case where user doesn't exist in users table yet
      if (userError && (userError as any).code === "PGRST116") {
        // User not found in users table, set default values
        userData = { is_pro: false };
      } else if (userError) {
        userData = { is_pro: false };
      } else {
        userData = userProfileData as UserData;
      }

      const isPro = userData?.is_pro || false;

      if (process.env.NODE_ENV === "development") {
        console.log("👤 User Profile Data:", {
          userId: user.id,
          isPro,
          userData,
        });
      }

      // If user is on auth route and authenticated, redirect to dashboard
      if (isAuthRoute) {
        const dashboardUrl = new URL("/dashboard", request.url);
        return NextResponse.redirect(dashboardUrl);
      }

      // Check paywall restrictions for non-pro users
      if (!isPro && request.nextUrl.pathname.startsWith("/dashboard")) {
        // Allow basic dashboard access but could add paywall logic here
        // For now, we'll allow access to dashboard for all users
      }
    } catch (error) {
      console.error("❌ Error fetching user profile in middleware:", error);
      // Continue with default userData
      userData = { is_pro: false };
    }
  }

  // If user is not authenticated and trying to access protected route
  if (!user && isProtectedRoute) {
    const authUrl = new URL("/auth", request.url);
    return NextResponse.redirect(authUrl);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};