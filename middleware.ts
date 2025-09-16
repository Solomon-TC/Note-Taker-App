/**
 * Next.js Middleware for Security Headers and Rate Limiting
 * 
 * This middleware adds security headers to all responses and applies rate limiting
 * to sensitive endpoints. It runs on all requests before they reach API routes.
 * 
 * Security headers implemented:
 * - Content Security Policy (CSP) - Prevents XSS attacks
 * - Strict Transport Security (HSTS) - Enforces HTTPS
 * - X-Frame-Options - Prevents clickjacking
 * - X-Content-Type-Options - Prevents MIME sniffing
 * - Referrer-Policy - Controls referrer information
 * - Permissions-Policy - Disables unnecessary browser features
 * 
 * Rate limiting applied to:
 * - Authentication endpoints
 * - Payment endpoints
 * - Content creation endpoints
 * - Feedback/voting endpoints
 * - Friend request endpoints
 * - AI chat endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitResponse } from '@/lib/rateLimit';

// ============================================================================
// SECURITY HEADERS CONFIGURATION
// ============================================================================

/**
 * Content Security Policy (CSP) Configuration
 * 
 * This CSP is designed to be strict but functional for the Scribly application.
 * It allows necessary resources while blocking potentially dangerous content.
 * 
 * To extend this CSP for additional services:
 * 1. Add new domains to the appropriate directive
 * 2. Test thoroughly in development
 * 3. Monitor CSP violation reports
 * 
 * Example extensions:
 * - For Google Analytics: add 'https://www.google-analytics.com' to script-src
 * - For external images: add domains to img-src
 * - For embedded videos: add domains to frame-src
 */
const CONTENT_SECURITY_POLICY = [
  // Default source - only allow same origin
  "default-src 'self'",
  
  // Scripts - allow self, inline scripts (for Next.js), and trusted CDNs
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com",
  
  // Styles - allow self, inline styles, and font/style CDNs
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  
  // Images - allow self, data URLs, and common image CDNs
  "img-src 'self' data: https: blob:",
  
  // Fonts - allow self and Google Fonts
  "font-src 'self' https://fonts.gstatic.com data:",
  
  // Connections - allow self, Supabase, Stripe, and API endpoints
  "connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co",
  
  // Frames - allow Stripe checkout and payment forms
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  
  // Objects and embeds - block all
  "object-src 'none'",
  "embed-src 'none'",
  
  // Base URI - restrict to self
  "base-uri 'self'",
  
  // Form actions - allow self and Stripe
  "form-action 'self' https://checkout.stripe.com",
  
  // Upgrade insecure requests in production
  process.env.NODE_ENV === 'production' ? "upgrade-insecure-requests" : "",
].filter(Boolean).join('; ');

/**
 * Security headers to add to all responses
 */
const SECURITY_HEADERS = {
  // Content Security Policy
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  
  // Strict Transport Security - enforce HTTPS for 2 years
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  
  // Prevent page from being embedded in frames (clickjacking protection)
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Control referrer information sent to other sites
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Disable potentially dangerous browser features
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()',
    'payment=()',
    'usb=()',
  ].join(', '),
  
  // Remove server information
  'X-Powered-By': '',
} as const;

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

/**
 * Rate limiting rules for different API endpoints
 * Maps URL patterns to rate limit configurations
 */
const RATE_LIMIT_RULES = [
  // Authentication endpoints - strict limits
  {
    pattern: /^\/api\/auth\//,
    config: RATE_LIMIT_CONFIGS.AUTH,
    keyPrefix: 'auth',
  },
  
  // Stripe/payment endpoints - moderate limits
  {
    pattern: /^\/api\/stripe\//,
    config: RATE_LIMIT_CONFIGS.PAYMENT,
    keyPrefix: 'payment',
  },
  
  // Feedback endpoints - prevent spam
  {
    pattern: /^\/api\/feedback/,
    config: RATE_LIMIT_CONFIGS.FEEDBACK,
    keyPrefix: 'feedback',
  },
  
  // Friend request endpoints - prevent spam
  {
    pattern: /^\/api\/friends/,
    config: RATE_LIMIT_CONFIGS.FRIEND_REQUESTS,
    keyPrefix: 'friends',
  },
  
  // AI chat endpoints - moderate limits due to cost
  {
    pattern: /^\/api\/ai/,
    config: RATE_LIMIT_CONFIGS.AI_CHAT,
    keyPrefix: 'ai',
  },
  
  // Content creation endpoints
  {
    pattern: /^\/api\/(pages|notebooks|sections)/,
    config: RATE_LIMIT_CONFIGS.CREATE_CONTENT,
    keyPrefix: 'content',
  },
  
  // General API endpoints - lenient limits
  {
    pattern: /^\/api\//,
    config: RATE_LIMIT_CONFIGS.GENERAL,
    keyPrefix: 'api',
  },
] as const;

// ============================================================================
// MIDDLEWARE IMPLEMENTATION
// ============================================================================

/**
 * Main middleware function
 * Applies security headers and rate limiting to all requests
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') && !pathname.startsWith('/api/')
  ) {
    return NextResponse.next();
  }
  
  // Apply rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    const rateLimitResult = await applyRateLimit(request, pathname);
    if (rateLimitResult) {
      return rateLimitResult; // Rate limit exceeded
    }
  }
  
  // Continue with the request
  const response = NextResponse.next();
  
  // Add security headers to all responses
  addSecurityHeaders(response);
  
  // Add additional headers for API routes
  if (pathname.startsWith('/api/')) {
    addApiHeaders(response);
  }
  
  return response;
}

/**
 * Apply rate limiting based on the request path
 */
async function applyRateLimit(request: NextRequest, pathname: string): Promise<NextResponse | null> {
  // Find matching rate limit rule
  const rule = RATE_LIMIT_RULES.find(rule => rule.pattern.test(pathname));
  
  if (!rule) {
    return null; // No rate limiting for this endpoint
  }
  
  try {
    const result = await checkRateLimit(request, rule.config, rule.keyPrefix);
    
    if (!result.allowed) {
      // Log rate limit violation
      console.warn('Rate limit exceeded in middleware', {
        pathname,
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
        totalHits: result.totalHits,
        limit: rule.config.maxRequests,
      });
      
      return createRateLimitResponse(rule.config, result.resetTime);
    }
    
    return null; // Rate limit passed
  } catch (error) {
    // Rate limiter failed, log error but allow request (fail open)
    console.error('Rate limiter error in middleware:', error);
    return null;
  }
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): void {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    } else {
      // Remove header if value is empty (like X-Powered-By)
      response.headers.delete(key);
    }
  });
}

/**
 * Add additional headers for API routes
 */
function addApiHeaders(response: NextResponse): void {
  // Prevent caching of API responses by default
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  // Add API-specific security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
}

/**
 * Extract client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip',
  ];
  
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      return value.split(',')[0].trim();
    }
  }
  
  return request.ip || 'unknown';
}

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

/**
 * Configure which paths the middleware should run on
 * 
 * The middleware will run on:
 * - All API routes (/api/*)
 * - All pages (for security headers)
 * 
 * The middleware will NOT run on:
 * - Static files (_next/static/*)
 * - Images, fonts, etc. (files with extensions)
 * - Next.js internals (_next/*)
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};

// ============================================================================
// UTILITY FUNCTIONS FOR TESTING
// ============================================================================

/**
 * Get the current CSP for testing/debugging
 * @returns Current Content Security Policy string
 */
export function getCurrentCSP(): string {
  return CONTENT_SECURITY_POLICY;
}

/**
 * Get all security headers for testing/debugging
 * @returns Object with all security headers
 */
export function getSecurityHeaders(): Record<string, string> {
  return { ...SECURITY_HEADERS };
}

/**
 * Check if a URL would be rate limited (for testing)
 * @param pathname - URL pathname to check
 * @returns Rate limit configuration if applicable, null otherwise
 */
export function getRateLimitConfigForPath(pathname: string) {
  const rule = RATE_LIMIT_RULES.find(rule => rule.pattern.test(pathname));
  return rule || null;
}