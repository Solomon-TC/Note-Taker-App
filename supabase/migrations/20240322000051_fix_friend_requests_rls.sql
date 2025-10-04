-- Fix RLS policies for friend_requests to ensure they can be fetched properly
-- This migration addresses the issue where friend requests aren't showing up

-- Drop and recreate the users SELECT policy with a simpler approach
-- Allow users to view profiles of anyone they have a friend request with
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view basic profile info for friend requests" ON users;

CREATE POLICY "Users can view profiles for friend requests"
  ON users FOR SELECT
  USING (
    auth.uid() = id 
    OR 
    id IN (
      SELECT sender_id FROM friend_requests WHERE receiver_id = auth.uid()
    )
    OR
    id IN (
      SELECT receiver_id FROM friend_requests WHERE sender_id = auth.uid()
    )
    OR
    id IN (
      SELECT friend_id FROM friends WHERE user_id = auth.uid()
    )
    OR
    id IN (
      SELECT user_id FROM friends WHERE friend_id = auth.uid()
    )
  );
