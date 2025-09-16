-- Ultimate Fix for Friends Page Visibility Issue
-- This migration addresses the core logical errors in RLS policies and functions

-- ============================================================================
-- FIX THE LOGICAL ERROR IN TEST FUNCTION
-- ============================================================================

-- Drop the buggy test function
DROP FUNCTION IF EXISTS test_user_page_access(UUID);

-- Create corrected test function with proper logic
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
-- COMPLETELY REBUILD RLS POLICIES WITH CORRECT LOGIC
-- ============================================================================

-- Disable RLS temporarily
ALTER TABLE pages DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "users_own_pages_full_access" ON pages;
DROP POLICY IF EXISTS "friends_can_view_shared_pages" ON pages;
DROP POLICY IF EXISTS "public_pages_visible_to_all" ON pages;

-- Re-enable RLS
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can do everything with their own pages
CREATE POLICY "users_own_pages_full_access"
ON pages FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Friends can view pages with 'friends' visibility (CORRECTED LOGIC)
CREATE POLICY "friends_can_view_shared_pages"
ON pages FOR SELECT
USING (
  visibility = 'friends' AND
  auth.uid() IS NOT NULL AND
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
-- ENSURE FRIENDS TABLE POLICIES ARE WORKING
-- ============================================================================

-- Disable RLS temporarily
ALTER TABLE friends DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "users_can_access_their_friendships" ON friends;

-- Re-enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Create simple friends policy
CREATE POLICY "users_can_access_their_friendships"
ON friends FOR ALL
USING (user_id = auth.uid() OR friend_id = auth.uid())
WITH CHECK (user_id = auth.uid() OR friend_id = auth.uid());

-- ============================================================================
-- CREATE COMPREHENSIVE DEBUG FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION debug_friends_page_access(
  p_current_user_id UUID,
  p_friend_user_id UUID
)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH friendship_check AS (
    SELECT 
      EXISTS(
        SELECT 1 FROM friends 
        WHERE (
          (user_id = p_current_user_id AND friend_id = p_friend_user_id) OR
          (friend_id = p_current_user_id AND user_id = p_friend_user_id)
        )
      ) as friendship_exists,
      (
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
          (user_id = p_current_user_id AND friend_id = p_friend_user_id) OR
          (friend_id = p_current_user_id AND user_id = p_friend_user_id)
        )
      ) as friendship_data
  ),
  friend_pages AS (
    SELECT 
      COUNT(*) as total_pages,
      COUNT(*) FILTER (WHERE visibility = 'private') as private_pages,
      COUNT(*) FILTER (WHERE visibility = 'friends') as friends_pages,
      COUNT(*) FILTER (WHERE visibility = 'public') as public_pages,
      json_agg(
        json_build_object(
          'id', id,
          'title', title,
          'visibility', visibility,
          'created_at', created_at
        )
      ) FILTER (WHERE visibility = 'friends') as friends_pages_data
    FROM pages 
    WHERE user_id = p_friend_user_id
  ),
  auth_context AS (
    SELECT 
      auth.uid() as current_auth_uid,
      auth.role() as current_auth_role
  )
  SELECT json_build_object(
    'current_user_id', p_current_user_id,
    'friend_user_id', p_friend_user_id,
    'auth_context', (SELECT row_to_json(auth_context) FROM auth_context),
    'friendship_exists', (SELECT friendship_exists FROM friendship_check),
    'friendship_data', (SELECT friendship_data FROM friendship_check),
    'friend_pages_summary', (SELECT row_to_json(friend_pages) FROM friend_pages),
    'should_have_access', (
      SELECT friendship_exists AND friends_pages > 0 
      FROM friendship_check, friend_pages
    ),
    'test_query_result', (
      SELECT json_agg(
        json_build_object(
          'page_id', id,
          'title', title,
          'visibility', visibility,
          'can_access_via_rls', true
        )
      )
      FROM pages 
      WHERE user_id = p_friend_user_id 
      AND visibility = 'friends'
      AND EXISTS (
        SELECT 1 FROM friends 
        WHERE (
          (user_id = p_current_user_id AND friend_id = p_friend_user_id) OR
          (friend_id = p_current_user_id AND user_id = p_friend_user_id)
        )
      )
    )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debug_friends_page_access(UUID, UUID) TO authenticated;

-- ============================================================================
-- CREATE FUNCTION TO SIMULATE RLS QUERY
-- ============================================================================

CREATE OR REPLACE FUNCTION simulate_friends_page_query(
  p_current_user_id UUID,
  p_friend_user_id UUID
)
RETURNS TABLE(
  page_id UUID,
  page_title TEXT,
  page_visibility TEXT,
  page_created_at TIMESTAMPTZ,
  access_granted BOOLEAN,
  access_reason TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    p.id as page_id,
    p.title as page_title,
    p.visibility as page_visibility,
    p.created_at as page_created_at,
    CASE 
      WHEN p.visibility = 'friends' AND EXISTS(
        SELECT 1 FROM friends f
        WHERE (
          (f.user_id = p_current_user_id AND f.friend_id = p_friend_user_id) OR
          (f.friend_id = p_current_user_id AND f.user_id = p_friend_user_id)
        )
      ) THEN true
      ELSE false
    END as access_granted,
    CASE 
      WHEN p.visibility = 'friends' AND EXISTS(
        SELECT 1 FROM friends f
        WHERE (
          (f.user_id = p_current_user_id AND f.friend_id = p_friend_user_id) OR
          (f.friend_id = p_current_user_id AND f.user_id = p_friend_user_id)
        )
      ) THEN 'friend_access'
      WHEN p.visibility = 'friends' THEN 'no_friendship'
      WHEN p.visibility = 'private' THEN 'private_page'
      WHEN p.visibility = 'public' THEN 'public_page'
      ELSE 'unknown'
    END as access_reason
  FROM pages p
  WHERE p.user_id = p_friend_user_id
  ORDER BY p.created_at DESC;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION simulate_friends_page_query(UUID, UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES FOR TESTING
-- ============================================================================

/*
-- Test 1: Debug friends page access
SELECT debug_friends_page_access('current-user-id', 'friend-user-id');

-- Test 2: Simulate the exact query the app makes
SELECT * FROM simulate_friends_page_query('current-user-id', 'friend-user-id');

-- Test 3: Check friendship status
SELECT check_friendship_status('current-user-id', 'friend-user-id');

-- Test 4: Test user page access
SELECT * FROM test_user_page_access('current-user-id');

-- Test 5: Direct friendship check
SELECT * FROM friends WHERE 
  (user_id = 'current-user-id' AND friend_id = 'friend-user-id') OR
  (friend_id = 'current-user-id' AND user_id = 'friend-user-id');

-- Test 6: Direct pages check
SELECT id, title, user_id, visibility FROM pages 
WHERE user_id = 'friend-user-id' AND visibility = 'friends';
*/