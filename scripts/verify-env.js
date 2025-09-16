/**
 * Environment Variable Validation Script
 * 
 * This script validates that all required environment variables are present
 * and properly configured before the application starts. It helps catch
 * configuration issues early in the deployment process.
 * 
 * Run this script during build time to ensure all required secrets are available.
 * 
 * Usage:
 * - npm run check:env
 * - node scripts/verify-env.js
 * - In CI/CD: Add as a build step before deployment
 */

const { exit } = require('process');

// ============================================================================
// ENVIRONMENT VARIABLE DEFINITIONS
// ============================================================================

/**
 * Required environment variables for the application to function
 * These MUST be present or the application will fail to start
 */
const REQUIRED_ENV_VARS = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL (public)',
    example: 'https://your-project.supabase.co',
    isPublic: true,
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key (public)',
    example: 'eyJ...',
    isPublic: true,
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Supabase service role key (server-only, NEVER expose to client)',
    example: 'eyJ...',
    isSecret: true,
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    description: 'Stripe publishable key (public)',
    example: 'pk_test_...',
    isPublic: true,
  },
  {
    name: 'STRIPE_SECRET_KEY',
    description: 'Stripe secret key (server-only, NEVER expose to client)',
    example: 'sk_test_...',
    isSecret: true,
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    description: 'Stripe webhook endpoint secret (server-only)',
    example: 'whsec_...',
    isSecret: true,
  },
];

/**
 * Optional environment variables that enhance functionality
 * The application will work without these but may have reduced features
 */
const OPTIONAL_ENV_VARS = [
  {
    name: 'OPENAI_API_KEY',
    description: 'OpenAI API key for AI features',
    example: 'sk-...',
    isSecret: true,
  },
  {
    name: 'STRIPE_PRICE_MONTHLY',
    description: 'Stripe price ID for monthly subscription',
    example: 'price_...',
  },
  {
    name: 'STRIPE_PRICE_YEARLY',
    description: 'Stripe price ID for yearly subscription',
    example: 'price_...',
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    description: 'Application base URL for redirects',
    example: 'https://your-app.com',
    isPublic: true,
  },
  {
    name: 'SENTRY_DSN',
    description: 'Sentry DSN for error monitoring',
    example: 'https://...@sentry.io/...',
  },
];

/**
 * Environment variables that should NEVER be exposed to the client
 * These will be checked to ensure they don't have NEXT_PUBLIC_ prefix
 */
const SECRET_ENV_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'SENTRY_DSN',
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate that a value looks like a valid environment variable value
 */
function validateEnvValue(name, value, config) {
  const errors = [];
  
  if (!value || value.trim() === '') {
    errors.push(`${name} is empty or whitespace only`);
    return errors;
  }
  
  // Check for placeholder values that indicate misconfiguration
  const placeholders = ['your-', 'example', 'placeholder', 'change-me', 'xxx'];
  if (placeholders.some(placeholder => value.toLowerCase().includes(placeholder))) {
    errors.push(`${name} appears to contain a placeholder value: ${value.substring(0, 20)}...`);
  }
  
  // Validate specific formats
  if (name.includes('SUPABASE_URL') && !value.startsWith('https://')) {
    errors.push(`${name} should start with https://`);
  }
  
  if (name.includes('STRIPE_PUBLISHABLE_KEY') && !value.startsWith('pk_')) {
    errors.push(`${name} should start with pk_`);
  }
  
  if (name.includes('STRIPE_SECRET_KEY') && !value.startsWith('sk_')) {
    errors.push(`${name} should start with sk_`);
  }
  
  if (name.includes('STRIPE_WEBHOOK_SECRET') && !value.startsWith('whsec_')) {
    errors.push(`${name} should start with whsec_`);
  }
  
  if (name.includes('OPENAI_API_KEY') && !value.startsWith('sk-')) {
    errors.push(`${name} should start with sk-`);
  }
  
  // Check minimum length for keys
  if (name.includes('KEY') && value.length < 20) {
    errors.push(`${name} appears too short to be a valid key`);
  }
  
  return errors;
}

/**
 * Check for common security issues
 */
function checkSecurityIssues() {
  const issues = [];
  
  // Check that secret variables don't have NEXT_PUBLIC_ prefix
  SECRET_ENV_VARS.forEach(varName => {
    const publicVarName = `NEXT_PUBLIC_${varName}`;
    if (process.env[publicVarName]) {
      issues.push(`🚨 SECURITY ISSUE: ${publicVarName} is exposed to the client! This should be ${varName} instead.`);
    }
  });
  
  // Check for development keys in production
  if (process.env.NODE_ENV === 'production') {
    const devIndicators = ['test', 'dev', 'development', 'local'];
    
    Object.entries(process.env).forEach(([key, value]) => {
      if (key.includes('KEY') && value) {
        devIndicators.forEach(indicator => {
          if (value.toLowerCase().includes(indicator)) {
            issues.push(`⚠️  WARNING: ${key} appears to be a development key in production environment`);
          }
        });
      }
    });
  }
  
  return issues;
}

/**
 * Main validation function
 */
function validateEnvironment() {
  console.log('🔍 Validating environment variables...\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  const results = {
    required: { present: [], missing: [], invalid: [] },
    optional: { present: [], missing: [] },
    security: [],
  };
  
  // Check required environment variables
  console.log('📋 Required Environment Variables:');
  REQUIRED_ENV_VARS.forEach(config => {
    const value = process.env[config.name];
    
    if (!value) {
      console.log(`❌ ${config.name} - MISSING`);
      console.log(`   Description: ${config.description}`);
      console.log(`   Example: ${config.example}\n`);
      results.required.missing.push(config);
      hasErrors = true;
    } else {
      const errors = validateEnvValue(config.name, value, config);
      if (errors.length > 0) {
        console.log(`⚠️  ${config.name} - INVALID`);
        errors.forEach(error => console.log(`   ${error}`));
        console.log('');
        results.required.invalid.push({ ...config, errors });
        hasErrors = true;
      } else {
        const displayValue = config.isSecret 
          ? `${value.substring(0, 8)}...` 
          : value.substring(0, 50) + (value.length > 50 ? '...' : '');
        console.log(`✅ ${config.name} - ${displayValue}`);
        results.required.present.push(config);
      }
    }
  });
  
  // Check optional environment variables
  console.log('\n📋 Optional Environment Variables:');
  OPTIONAL_ENV_VARS.forEach(config => {
    const value = process.env[config.name];
    
    if (!value) {
      console.log(`⚪ ${config.name} - Not set (optional)`);
      console.log(`   Description: ${config.description}`);
      console.log(`   Example: ${config.example}\n`);
      results.optional.missing.push(config);
    } else {
      const errors = validateEnvValue(config.name, value, config);
      if (errors.length > 0) {
        console.log(`⚠️  ${config.name} - INVALID`);
        errors.forEach(error => console.log(`   ${error}`));
        console.log('');
        hasWarnings = true;
      } else {
        const displayValue = config.isSecret 
          ? `${value.substring(0, 8)}...` 
          : value.substring(0, 50) + (value.length > 50 ? '...' : '');
        console.log(`✅ ${config.name} - ${displayValue}`);
        results.optional.present.push(config);
      }
    }
  });
  
  // Check security issues
  console.log('\n🔒 Security Checks:');
  const securityIssues = checkSecurityIssues();
  results.security = securityIssues;
  
  if (securityIssues.length === 0) {
    console.log('✅ No security issues detected');
  } else {
    securityIssues.forEach(issue => {
      console.log(issue);
      if (issue.includes('🚨')) {
        hasErrors = true;
      } else {
        hasWarnings = true;
      }
    });
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`Required variables: ${results.required.present.length}/${REQUIRED_ENV_VARS.length} configured`);
  console.log(`Optional variables: ${results.optional.present.length}/${OPTIONAL_ENV_VARS.length} configured`);
  console.log(`Security issues: ${securityIssues.length}`);
  
  if (hasErrors) {
    console.log('\n❌ Environment validation failed! Please fix the errors above before deploying.');
    console.log('\n💡 Tips:');
    console.log('- Check your .env.local file (for local development)');
    console.log('- Verify environment variables in your deployment platform');
    console.log('- Ensure secret keys are not exposed with NEXT_PUBLIC_ prefix');
    console.log('- Double-check that all keys are copied correctly without extra spaces');
    exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  Environment validation passed with warnings. Review the warnings above.');
    exit(0);
  } else {
    console.log('\n✅ Environment validation passed! All required variables are properly configured.');
    exit(0);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a template .env file with all required variables
 */
function generateEnvTemplate() {
  console.log('# Environment Variables Template for Scribly');
  console.log('# Copy this to .env.local and fill in your actual values\n');
  
  console.log('# Required Variables (Application will not work without these)');
  REQUIRED_ENV_VARS.forEach(config => {
    console.log(`# ${config.description}`);
    console.log(`${config.name}=${config.example}`);
    console.log('');
  });
  
  console.log('# Optional Variables (Enhance functionality)');
  OPTIONAL_ENV_VARS.forEach(config => {
    console.log(`# ${config.description}`);
    console.log(`# ${config.name}=${config.example}`);
    console.log('');
  });
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

const command = process.argv[2];

switch (command) {
  case 'template':
    generateEnvTemplate();
    break;
  case 'validate':
  default:
    validateEnvironment();
    break;
}

module.exports = {
  validateEnvironment,
  generateEnvTemplate,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS,
};