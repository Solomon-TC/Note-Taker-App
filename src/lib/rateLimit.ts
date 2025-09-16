/**
 * Rate Limiting Middleware for API Routes
 * 
 * This module provides IP-based rate limiting to prevent abuse of sensitive endpoints.
 * Uses an in-memory LRU cache for simplicity in development/small deployments.
 * 
 * PRODUCTION RECOMMENDATION:
 * For production deployments with multiple instances, replace this with a distributed
 * rate limiter using Redis/Upstash. Example:
 * 
 * import { Ratelimit } from "@upstash/ratelimit";
 * import { Redis } from "@upstash/redis";
 * 
 * const ratelimit = new Ratelimit({
 *   redis: Redis.fromEnv(),
 *   limiter: Ratelimit.slidingWindow(10, "10 s"),
 * });
 * 
 * Security considerations:
 * - Uses IP address for identification (can be spoofed but good enough for basic protection)
 * - Configurable limits per endpoint
 * - Fails open (allows requests if rate limiter fails)
 * - Logs rate limit violations for monitoring
 */

import { LRUCache } from 'lru-cache';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Skip counting successful requests */
  skipSuccessfulRequests?: boolean;
  /** Skip counting failed requests */
  skipFailedRequests?: boolean;
  /** Custom message for rate limit exceeded */
  message?: string;
  /** Custom status code for rate limit exceeded */
  statusCode?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  message: 'Too many requests, please try again later.',
  statusCode: 429,
};

// Predefined rate limit configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints (stricter limits)
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
  },
  
  // Payment endpoints (moderate limits)
  PAYMENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    message: 'Too many payment requests, please try again later.',
  },
  
  // Content creation (moderate limits)
  CREATE_CONTENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 creates per minute
    message: 'Too many content creation requests, please try again later.',
  },
  
  // Feedback/voting (stricter to prevent spam)
  FEEDBACK: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 feedback actions per minute
    message: 'Too many feedback requests, please try again later.',
  },
  
  // Friend requests (strict to prevent spam)
  FRIEND_REQUESTS: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10, // 10 friend requests per 5 minutes
    message: 'Too many friend requests, please try again later.',
  },
  
  // AI chat (moderate limits due to cost)
  AI_CHAT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 messages per minute
    message: 'Too many AI chat requests, please try again later.',
  },
  
  // General API (lenient)
  GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many requests, please try again later.',
  },
} as const;

// ============================================================================
// IN-MEMORY RATE LIMITER
// ============================================================================

class InMemoryRateLimiter {
  private cache: LRUCache<string, RateLimitEntry>;
  
  constructor(maxSize: number = 10000) {
    this.cache = new LRUCache({
      max: maxSize,
      ttl: 24 * 60 * 60 * 1000, // 24 hours TTL
    });
  }
  
  /**
   * Check if request should be rate limited
   * @param key - Unique identifier (usually IP address)
   * @param config - Rate limit configuration
   * @returns Object with allowed status and remaining requests
   */
  checkLimit(key: string, config: RateLimitConfig): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalHits: number;
  } {
    const now = Date.now();
    const windowMs = config.windowMs || DEFAULT_CONFIG.windowMs;
    const maxRequests = config.maxRequests || DEFAULT_CONFIG.maxRequests;
    
    const entry = this.cache.get(key);
    
    if (!entry || now > entry.resetTime) {
      // First request in window or window expired
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.cache.set(key, newEntry);
      
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: newEntry.resetTime,
        totalHits: 1,
      };
    }
    
    // Increment counter
    entry.count++;
    this.cache.set(key, entry);
    
    const allowed = entry.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - entry.count);
    
    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
      totalHits: entry.count,
    };
  }
  
  /**
   * Reset rate limit for a specific key
   * @param key - Key to reset
   */
  reset(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Get current stats for a key
   * @param key - Key to check
   * @returns Current rate limit stats or null if not found
   */
  getStats(key: string): RateLimitEntry | null {
    return this.cache.get(key) || null;
  }
}

// Global rate limiter instance
const rateLimiter = new InMemoryRateLimiter();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract client IP address from request
 * Handles various proxy headers and fallbacks
 * 
 * @param request - Next.js request object
 * @returns IP address string
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for real IP (in order of preference)
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'x-forwarded',
    'forwarded-for',
    'forwarded',
  ];
  
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip && ip !== 'unknown') {
        return ip;
      }
    }
  }
  
  // Fallback to connection IP (may not be available in all environments)
  return request.ip || 'unknown';
}

/**
 * Generate rate limit key for a request
 * @param request - Next.js request object
 * @param prefix - Optional prefix for the key
 * @returns Rate limit key
 */
function generateRateLimitKey(request: NextRequest, prefix?: string): string {
  const ip = getClientIP(request);
  const baseKey = `ratelimit:${ip}`;
  
  return prefix ? `${baseKey}:${prefix}` : baseKey;
}

// ============================================================================
// MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Rate limiting middleware for API routes
 * 
 * @param config - Rate limit configuration
 * @param keyPrefix - Optional prefix for rate limit key (to separate different endpoints)
 * @returns Middleware function
 */
export function createRateLimitMiddleware(
  config: Partial<RateLimitConfig> = {},
  keyPrefix?: string
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  return async function rateLimitMiddleware(
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse> | NextResponse
  ): Promise<NextResponse> {
    try {
      const key = generateRateLimitKey(request, keyPrefix);
      const result = rateLimiter.checkLimit(key, finalConfig);
      
      // Add rate limit headers to response
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', finalConfig.maxRequests.toString());
      headers.set('X-RateLimit-Remaining', result.remaining.toString());
      headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
      
      if (!result.allowed) {
        // Log rate limit violation
        console.warn('Rate limit exceeded', {
          ip: getClientIP(request),
          key,
          totalHits: result.totalHits,
          limit: finalConfig.maxRequests,
          resetTime: new Date(result.resetTime).toISOString(),
          userAgent: request.headers.get('user-agent'),
          url: request.url,
        });
        
        return new NextResponse(
          JSON.stringify({
            error: finalConfig.message,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          }),
          {
            status: finalConfig.statusCode,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
              ...Object.fromEntries(headers.entries()),
            },
          }
        );
      }
      
      // Execute the handler
      const response = await handler(request);
      
      // Add rate limit headers to successful response
      headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
      
      return response;
    } catch (error) {
      // Rate limiter failed, log error but allow request (fail open)
      console.error('Rate limiter error:', error);
      return handler(request);
    }
  };
}

/**
 * Simple rate limit check function for use in API routes
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @param keyPrefix - Optional key prefix
 * @returns Rate limit result
 */
export async function checkRateLimit(
  request: NextRequest,
  config: Partial<RateLimitConfig> = {},
  keyPrefix?: string
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const key = generateRateLimitKey(request, keyPrefix);
  
  return rateLimiter.checkLimit(key, finalConfig);
}

/**
 * Reset rate limit for current request IP
 * Useful for testing or administrative purposes
 * 
 * @param request - Next.js request object
 * @param keyPrefix - Optional key prefix
 */
export function resetRateLimit(request: NextRequest, keyPrefix?: string): void {
  const key = generateRateLimitKey(request, keyPrefix);
  rateLimiter.reset(key);
}

// ============================================================================
// HELPER FUNCTIONS FOR COMMON PATTERNS
// ============================================================================

/**
 * Apply rate limiting to an API route handler
 * 
 * @param handler - API route handler
 * @param config - Rate limit configuration
 * @param keyPrefix - Optional key prefix
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit<T extends NextRequest>(
  handler: (req: T) => Promise<NextResponse> | NextResponse,
  config: Partial<RateLimitConfig> = {},
  keyPrefix?: string
) {
  const middleware = createRateLimitMiddleware(config, keyPrefix);
  
  return async (request: T): Promise<NextResponse> => {
    return middleware(request, handler);
  };
}

/**
 * Create a rate limit response
 * Utility function to create consistent rate limit exceeded responses
 * 
 * @param config - Rate limit configuration
 * @param resetTime - When the rate limit resets
 * @returns NextResponse with rate limit error
 */
export function createRateLimitResponse(
  config: Partial<RateLimitConfig> = {},
  resetTime: number
): NextResponse {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  
  return new NextResponse(
    JSON.stringify({
      error: finalConfig.message,
      retryAfter,
    }),
    {
      status: finalConfig.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
      },
    }
  );
}

// ============================================================================
// MONITORING AND STATS
// ============================================================================

/**
 * Get rate limiter statistics
 * Useful for monitoring and debugging
 * 
 * @returns Basic stats about the rate limiter
 */
export function getRateLimiterStats(): {
  cacheSize: number;
  maxSize: number;
} {
  return {
    cacheSize: rateLimiter['cache'].size,
    maxSize: rateLimiter['cache'].max,
  };
}