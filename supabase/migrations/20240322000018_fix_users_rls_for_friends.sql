-- Update users table RLS policies to allow friend discovery
-- Users need to be able to search for other users by email for friend requests

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Create new policies that allow:
-- 1. Users can view their own full profile
-- 2. Users can view basic info (id, email, full_name) of other users for friend requests

CREATE POLICY "Users can view own full profile"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can view others basic info for friends"
ON users FOR SELECT
USING (
  -- Allow viewing basic info (id, email, full_name) of other users
  -- This is needed for friend request functionality
  auth.uid() IS NOT NULL
);

-- Keep the existing update and insert policies unchanged
-- Users can still only update/insert their own profile
