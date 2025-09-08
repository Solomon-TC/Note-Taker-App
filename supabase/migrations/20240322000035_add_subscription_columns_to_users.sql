-- Add subscription-related columns to users table
-- This migration is safe to run multiple times

-- Add stripe_customer_id column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add is_pro column with default false and not null constraint
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_pro boolean DEFAULT false NOT NULL;

-- Add plan column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS plan text;

-- Add current_period_end column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- Create index on stripe_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id 
ON users(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- Create index on is_pro for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_is_pro 
ON users(is_pro);

-- Add comment to document the subscription columns
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for subscription management';
COMMENT ON COLUMN users.is_pro IS 'Whether user has an active pro subscription';
COMMENT ON COLUMN users.plan IS 'Current subscription plan (monthly, yearly, etc.)';
COMMENT ON COLUMN users.current_period_end IS 'End date of current subscription period';
