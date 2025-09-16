-- Final Fix for Friends Page Visibility Issue
-- This migration simplifies and fixes the RLS policies to allow proper friend access

-- ============================================================================
-- COMPLETELY RESET AND REBUILD PAGES TABLE RLS POLICIES
-- ============================================================================

-- Disable RLS temporarily to clean up completely
ALTER TABLE pages DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on pages table to start fresh
DROP POLICY IF EXISTS "Owner full access to pages" ON pages;
DROP POLICY IF EXISTS "Friends can read shared pages" ON pages;
DROP POLICY IF EXISTS "Public pages readable by all" ON pages;
DROP POLICY IF EXISTS "Users can manage their own pages" ON pages;
DROP POLICY IF EXISTS "Friends can view pages with friends visibility" ON pages;
DROP POLICY IF EXISTS "Anyone can view public pages" ON pages;
DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
DROP POLICY IF EXISTS "Users can create their own pages" ON pages;
DROP POLICY IF EXISTS "Users can update their own pages" ON pages;
DROP POLICY IF EXISTS "Users can delete their own pages" ON pages;

-- Re-enable RLS
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE SIMPLE, WORKING RLS POLICIES
-- ============================================================================

-- Policy 1: Users can do everything with their own pages
CREATE POLICY "users_own_pages_full_access"
ON pages FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Friends can view pages with 'friends' visibility (SIMPLIFIED)
CREATE POLICY "friends_can_view_shared_pages"
ON pages FOR SELECT
USING (
  visibility = 'friends' AND
  EXISTS (
    SELECT 1 FROM friends 
    WHERE (
      (user_id = auth.uid() AND friend_id = pages.user_id) OR
      (friend_id = auth.uid() AND user_id = pages.user_id)
    )
  )
);

-- Policy 3: Public pages visible to all authenticated users
CREATE POLICY "public_pages_visible_to_all"
ON pages FOR SELECT
USING (
  visibility = 'public' AND 
  auth.role() = 'authenticated'
);

-- ============================================================================
-- ENSURE FRIENDS TABLE POLICIES ARE SIMPLE AND WORKING
-- ============================================================================

-- Disable RLS temporarily
ALTER TABLE friends DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can access their friendships" ON friends;
DROP POLICY IF EXISTS "Users can view their friendships" ON friends;
DROP POLICY IF EXISTS "Users can create friendships" ON friends;
DROP POLICY IF EXISTS "Users can update friendships" ON friends;
DROP POLICY IF EXISTS "Users can delete friendships" ON friends;

-- Re-enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Create simple friends policy
CREATE POLICY "users_can_access_their_friendships"
ON friends FOR ALL
USING (user_id = auth.uid() OR friend_id = auth.uid())
WITH CHECK (user_id = auth.uid() OR friend_id = auth.uid());

-- ============================================================================
-- CREATE SIMPLE TEST FUNCTION
-- ============================================================================

-- Simple function to test what pages a user can see
CREATE OR REPLACE FUNCTION test_user_page_access(p_user_id UUID)
RETURNS TABLE(
  page_id UUID,
  page_title TEXT,
  page_owner_id UUID,
  page_visibility TEXT,
  access_type TEXT,
  can_access BOOLEAN
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    p.id as page_id,
    p.title as page_title,
    p.user_id as page_owner_id,
    p.visibility as page_visibility,
    CASE 
      WHEN p.user_id = p_user_id THEN 'owner'
      WHEN p.visibility = 'public' THEN 'public'
      WHEN p.visibility = 'friends' AND EXISTS(
        SELECT 1 FROM friends f
        WHERE (
          (f.user_id = p_user_id AND f.friend_id = p.user_id) OR
          (f.friend_id = p_user_id AND f.user_id = p.user_id)
        )
      ) THEN 'friend'
      ELSE 'no_access'
    END as access_type,
    CASE 
      WHEN p.user_id = p_user_id THEN true
      WHEN p.visibility = 'public' THEN true
      WHEN p.visibility = 'friends' AND EXISTS(
        SELECT 1 FROM friends f
        WHERE (
          (f.user_id = p_user_id AND f.friend_id = p.user_id) OR
          (f.friend_id = p_user_id AND f.user_id = p.user_id)
        )
      ) THEN true
      ELSE false
    END as can_access
  FROM pages p
  ORDER BY p.created_at DESC;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_user_page_access(UUID) TO authenticated;

-- ============================================================================
-- CREATE FUNCTION TO CHECK FRIENDSHIP STATUS
-- ============================================================================

CREATE OR REPLACE FUNCTION check_friendship_status(p_user1_id UUID, p_user2_id UUID)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'user1_id', p_user1_id,
    'user2_id', p_user2_id,
    'are_friends', EXISTS(
      SELECT 1 FROM friends 
      WHERE (
        (user_id = p_user1_id AND friend_id = p_user2_id) OR
        (friend_id = p_user1_id AND user_id = p_user2_id)
      )
    ),
    'friendship_details', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'user_id', user_id,
          'friend_id', friend_id,
          'created_at', created_at
        )
      )
      FROM friends 
      WHERE (
        (user_id = p_user1_id AND friend_id = p_user2_id) OR
        (friend_id = p_user1_id AND user_id = p_user2_id)
      )
    )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_friendship_status(UUID, UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to test)
-- ============================================================================

/*
-- Test 1: Check what pages a user can access
SELECT * FROM test_user_page_access('your-user-id-here');

-- Test 2: Check friendship status between two users
SELECT check_friendship_status('user1-id', 'user2-id');

-- Test 3: Direct query to see all pages (as a specific user context)
-- This should be run with proper auth context
SELECT id, title, user_id, visibility FROM pages;

-- Test 4: Check friends table
SELECT * FROM friends;
*/