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
    
    process.exit(1);
  }

  console.log('✅ Environment validation passed!');
}

// Validate URLs
function validateUrls() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (supabaseUrl) {
    try {
      new URL(supabaseUrl);
      console.log('✅ Supabase URL is valid');
    } catch (error) {
      console.error('🚨 Invalid Supabase URL:', supabaseUrl);
      process.exit(1);
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      new URL(appUrl);
      console.log('✅ App URL is valid');
    } catch (error) {
      console.error('🚨 Invalid App URL:', appUrl);
      process.exit(1);
    }
  }
}

// Main validation
function main() {
  console.log('🚀 Starting pre-build validation...\n');
  
  validateEnvironment();
  validateUrls();
  
  console.log('\n🎉 All validations passed! Ready to build.');
}

if (require.main === module) {
  main();
}

module.exports = { validateEnvironment, validateUrls };