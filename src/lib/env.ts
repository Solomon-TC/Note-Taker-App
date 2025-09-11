/**
 * Environment variable validation utility for Vercel deployment
 */

export interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  OpenAI_API?: string;
  STRIPE_SECRET_KEY?: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

export function validateEnvironment(): EnvConfig {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ] as const;

  const optionalVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'OpenAI_API',
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_APP_URL'
  ] as const;

  const missing: string[] = [];
  const config: Partial<EnvConfig> = {};

  // Check required variables
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      missing.push(varName);
    } else {
      config[varName] = value;
    }
  }

  // Check optional variables
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value) {
      config[varName] = value;
    }
  }

  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}`;
    
    // Only log error in development, don't throw during build
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Environment validation failed:', error);
    }
    
    // Only throw in production runtime, not during build or in development
    if (process.env.NODE_ENV === 'production' && 
        process.env.VERCEL_ENV && 
        process.env.VERCEL_ENV !== 'preview' &&
        !process.env.VERCEL_BUILDER &&
        typeof window === 'undefined') {
      throw new Error(error);
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Development mode: continuing with missing variables');
    }
  }

  return config as EnvConfig;
}

export function getEnvVar(name: keyof EnvConfig, fallback?: string): string {
  const value = process.env[name];
  if (!value) {
    if (fallback !== undefined) {
      return fallback;
    }
    
    // Don't throw during build
    if (process.env.VERCEL_BUILDER || process.env.NODE_ENV !== 'production') {
      console.warn(`⚠️ Environment variable ${name} is not set, using empty string`);
      return '';
    }
    
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

// Safe environment validation that won't break builds
let envConfig: EnvConfig | null = null;

try {
  // Only validate environment on module load in specific conditions
  if (typeof window === 'undefined' && 
      process.env.NODE_ENV === 'production' && 
      process.env.VERCEL_ENV && 
      process.env.VERCEL_ENV !== 'preview' &&
      !process.env.VERCEL_BUILDER) {
    envConfig = validateEnvironment();
    console.log('✅ Environment validation passed');
  } else {
    // In development or build time, create config without validation
    envConfig = validateEnvironment();
  }
} catch (error) {
  console.error('🚨 Environment validation failed:', error);
  // Create a fallback config to prevent build failures
  envConfig = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OpenAI_API: process.env.OpenAI_API,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };
}

// Export the validated environment configuration
export const env = envConfig;