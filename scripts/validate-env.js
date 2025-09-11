#!/usr/bin/env node

/**
 * Pre-build environment validation script
 * Run this before building to catch environment issues early
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

const optionalEnvVars = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'OpenAI_API',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_APP_URL'
];

function validateEnvironment() {
  console.log('🔍 Validating environment variables...');
  
  const missing = [];
  const present = [];
  const optional = [];

  // Check required variables
  for (const varName of requiredEnvVars) {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }

  // Check optional variables
  for (const varName of optionalEnvVars) {
    if (process.env[varName]) {
      optional.push(varName);
    }
  }

  // Report results
  if (present.length > 0) {
    console.log('✅ Required variables present:', present.join(', '));
  }

  if (optional.length > 0) {
    console.log('✅ Optional variables present:', optional.join(', '));
  }

  if (missing.length > 0) {
    console.error('🚨 Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    
    console.error('\n💡 Please set these variables in your Vercel project settings:');
    console.error('   https://vercel.com/dashboard -> Project -> Settings -> Environment Variables');
    
    // In Vercel builds, don't exit with error - let the build continue
    if (process.env.VERCEL || process.env.CI) {
      console.warn('⚠️  Running in CI/Vercel - continuing build despite missing variables');
      console.warn('   The application may not function correctly without these variables');
      return false;
    }
    
    process.exit(1);
  }

  console.log('✅ Environment validation passed!');
  return true;
}

// Validate URLs with better error handling
function validateUrls() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (supabaseUrl) {
    try {
      new URL(supabaseUrl);
      console.log('✅ Supabase URL is valid');
    } catch (error) {
      console.error('🚨 Invalid Supabase URL:', supabaseUrl);
      if (!process.env.VERCEL && !process.env.CI) {
        process.exit(1);
      }
      return false;
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      new URL(appUrl);
      console.log('✅ App URL is valid');
    } catch (error) {
      console.error('🚨 Invalid App URL:', appUrl);
      if (!process.env.VERCEL && !process.env.CI) {
        process.exit(1);
      }
      return false;
    }
  }
  
  return true;
}

// Check Node.js version
function validateNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  console.log(`📦 Node.js version: ${nodeVersion}`);
  
  if (majorVersion < 18) {
    console.error('🚨 Node.js version 18 or higher is required');
    if (!process.env.VERCEL && !process.env.CI) {
      process.exit(1);
    }
    return false;
  }
  
  console.log('✅ Node.js version is compatible');
  return true;
}

// Check memory and build environment
function validateBuildEnvironment() {
  try {
    const memoryUsage = process.memoryUsage();
    const totalMemoryMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    
    console.log(`💾 Memory usage: ${totalMemoryMB}MB`);
    
    if (process.env.VERCEL) {
      console.log('🚀 Running in Vercel build environment');
      
      // Set build optimizations for Vercel
      process.env.NEXT_TELEMETRY_DISABLED = '1';
      
      // Only set memory limit if not already set
      if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('max-old-space-size')) {
        process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --max-old-space-size=4096';
      }
      
      console.log('✅ Vercel build optimizations applied');
    }
  } catch (error) {
    console.warn('⚠️ Could not validate build environment:', error.message);
  }
  
  return true;
}

// Main validation
function main() {
  console.log('🚀 Starting pre-build validation...\n');
  
  let allValid = true;
  
  try {
    allValid &= validateNodeVersion();
    allValid &= validateBuildEnvironment();
    allValid &= validateEnvironment();
    allValid &= validateUrls();
    
    if (allValid) {
      console.log('\n🎉 All validations passed! Ready to build.');
    } else {
      console.log('\n⚠️  Some validations failed, but continuing build...');
    }
  } catch (error) {
    console.error('🚨 Validation error:', error.message);
    if (!process.env.VERCEL && !process.env.CI) {
      process.exit(1);
    }
    allValid = false;
  }
  
  return allValid;
}

if (require.main === module) {
  main();
}

module.exports = { validateEnvironment, validateUrls, validateNodeVersion, validateBuildEnvironment };