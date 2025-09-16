-- Fix Visibility Toggle Persistence and Friends Page Access Issues
-- This migration addresses the remaining issues with visibility changes and friend access

-- ============================================================================
-- COMPLETELY REBUILD PAGES TABLE RLS POLICIES
-- ============================================================================

-- Disable RLS temporarily to clean up completely
ALTER TABLE pages DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on pages table
DROP POLICY IF EXISTS "Users can manage their own pages" ON pages;
DROP POLICY IF EXISTS "Friends can view pages with friends visibility" ON pages;
DROP POLICY IF EXISTS "Anyone can view public pages" ON pages;
DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
DROP POLICY IF EXISTS "Users can create their own pages" ON pages;
DROP POLICY IF EXISTS "Users can update their own pages" ON pages;
DROP POLICY IF EXISTS "Users can delete their own pages" ON pages;
DROP POLICY IF EXISTS "Friends can view shared pages" ON pages;

-- Re-enable RLS
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Create simplified, working policies

-- 1. Users can do everything with their own pages
CREATE POLICY "Owner full access to pages"
ON pages FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Friends can SELECT pages with friends visibility
CREATE POLICY "Friends can read shared pages"
ON pages FOR SELECT
USING (
  visibility = 'friends' AND
  auth.uid() != user_id AND  -- Not the owner
  EXISTS (
    SELECT 1 FROM friends 
    WHERE (
      (user_id = auth.uid() AND friend_id = pages.user_id) OR
      (friend_id = auth.uid() AND user_id = pages.user_id)
    )
  )
);

-- 3. Public pages visible to all authenticated users
CREATE POLICY "Public pages readable by all"
ON pages FOR SELECT
USING (
  visibility = 'public' AND 
  auth.role() = 'authenticated'
);

-- ============================================================================
-- ENSURE FRIENDS TABLE POLICIES ARE CORRECT
-- ============================================================================

-- Disable RLS temporarily
ALTER TABLE friends DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own friendships" ON friends;
DROP POLICY IF EXISTS "Users can manage their own friendships" ON friends;
DROP POLICY IF EXISTS "Users can view their friendships" ON friends;
DROP POLICY IF EXISTS "Users can create friendships" ON friends;
DROP POLICY IF EXISTS "Users can update friendships" ON friends;
DROP POLICY IF EXISTS "Users can delete friendships" ON friends;

-- Re-enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Create simple, working friends policies
CREATE POLICY "Users can access their friendships"
ON friends FOR ALL
USING (user_id = auth.uid() OR friend_id = auth.uid())
WITH CHECK (user_id = auth.uid() OR friend_id = auth.uid());

-- ============================================================================
-- CREATE COMPREHENSIVE DEBUG AND TEST FUNCTIONS
-- ============================================================================

-- Function to test page visibility and access
CREATE OR REPLACE FUNCTION test_page_visibility_access(
  p_page_id UUID,
  p_test_user_id UUID
)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH page_data AS (
    SELECT 
      id,
      title,
      user_id as page_owner_id,
      visibility,
      created_at
    FROM pages 
    WHERE id = p_page_id
  ),
  friendship_data AS (
    SELECT 
      id,
      user_id,
      friend_id,
      created_at
    FROM friends 
    WHERE (
      (user_id = p_test_user_id AND friend_id = (SELECT page_owner_id FROM page_data)) OR
      (friend_id = p_test_user_id AND user_id = (SELECT page_owner_id FROM page_data))
    )
  ),
  access_check AS (
    SELECT 
      CASE 
        WHEN (SELECT page_owner_id FROM page_data) = p_test_user_id THEN 'owner'
        WHEN (SELECT visibility FROM page_data) = 'public' THEN 'public'
        WHEN (SELECT visibility FROM page_data) = 'friends' AND EXISTS(SELECT 1 FROM friendship_data) THEN 'friend'
        WHEN (SELECT visibility FROM page_data) = 'private' THEN 'private_no_access'
        ELSE 'no_access'
      END as access_type,
      CASE 
        WHEN (SELECT page_owner_id FROM page_data) = p_test_user_id THEN true
        WHEN (SELECT visibility FROM page_data) = 'public' THEN true
        WHEN (SELECT visibility FROM page_data) = 'friends' AND EXISTS(SELECT 1 FROM friendship_data) THEN true
        ELSE false
      END as can_access
  )
  SELECT json_build_object(
    'page_id', p_page_id,
    'test_user_id', p_test_user_id,
    'page_exists', EXISTS(SELECT 1 FROM page_data),
    'page_info', (SELECT row_to_json(page_data) FROM page_data),
    'friendship_exists', EXISTS(SELECT 1 FROM friendship_data),
    'friendship_data', (SELECT json_agg(row_to_json(friendship_data)) FROM friendship_data),
    'access_type', (SELECT access_type FROM access_check),
    'can_access', (SELECT can_access FROM access_check),
    'auth_context', json_build_object(
      'current_auth_uid', auth.uid(),
      'current_auth_role', auth.role()
    )
  );
$$;

-- Function to get all accessible pages for a user
CREATE OR REPLACE FUNCTION get_user_accessible_pages(p_user_id UUID)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH user_pages AS (
    SELECT 
      id, title, visibility, 'owner' as access_type, created_at
    FROM pages 
    WHERE user_id = p_user_id
  ),
  friend_pages AS (
    SELECT DISTINCT
      p.id, p.title, p.visibility, 'friend' as access_type, p.created_at
    FROM pages p
    INNER JOIN friends f ON (
      (f.user_id = p_user_id AND f.friend_id = p.user_id) OR
      (f.friend_id = p_user_id AND f.user_id = p.user_id)
    )
    WHERE p.visibility = 'friends'
    AND p.user_id != p_user_id
  ),
  public_pages AS (
    SELECT 
      id, title, visibility, 'public' as access_type, created_at
    FROM pages 
    WHERE visibility = 'public'
    AND user_id != p_user_id
  ),
  all_accessible AS (
    SELECT * FROM user_pages
    UNION ALL
    SELECT * FROM friend_pages
    UNION ALL
    SELECT * FROM public_pages
  )
  SELECT json_build_object(
    'user_id', p_user_id,
    'total_accessible', (SELECT COUNT(*) FROM all_accessible),
    'own_pages', (SELECT COUNT(*) FROM user_pages),
    'friend_pages', (SELECT COUNT(*) FROM friend_pages),
    'public_pages', (SELECT COUNT(*) FROM public_pages),
    'pages', (SELECT json_agg(row_to_json(all_accessible)) FROM all_accessible)
  );
$$;

-- Function to debug friendship relationships
CREATE OR REPLACE FUNCTION debug_user_friendships(p_user_id UUID)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH user_friendships AS (
    SELECT 
      id,
      CASE 
        WHEN user_id = p_user_id THEN friend_id
        ELSE user_id
      END as friend_user_id,
      CASE 
        WHEN user_id = p_user_id THEN 'outgoing'
        ELSE 'incoming'
      END as direction,
      created_at
    FROM friends 
    WHERE user_id = p_user_id OR friend_id = p_user_id
  ),
  friend_details AS (
    SELECT 
      uf.*,
      u.email as friend_email,
      u.full_name as friend_name
    FROM user_friendships uf
    LEFT JOIN users u ON u.id = uf.friend_user_id
  )
  SELECT json_build_object(
    'user_id', p_user_id,
    'total_friendships', (SELECT COUNT(*) FROM user_friendships),
    'friendships', (SELECT json_agg(row_to_json(friend_details)) FROM friend_details)
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION test_page_visibility_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_accessible_pages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_user_friendships(UUID) TO authenticated;

-- ============================================================================
-- ADD VISIBILITY COLUMN INDEX FOR PERFORMANCE
-- ============================================================================

-- Create index on visibility column for better query performance
CREATE INDEX IF NOT EXISTS idx_pages_visibility ON pages(visibility);
CREATE INDEX IF NOT EXISTS idx_pages_user_visibility ON pages(user_id, visibility);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test query to verify policies work (run these manually to test)
/*
-- Test 1: Check if user can see their own pages
SELECT 'Test 1: Own pages' as test, COUNT(*) as count 
FROM pages WHERE user_id = auth.uid();

-- Test 2: Check if user can see friend's shared pages
SELECT 'Test 2: Friend shared pages' as test, COUNT(*) as count 
FROM pages 
WHERE visibility = 'friends' 
AND user_id != auth.uid()
AND EXISTS (
  SELECT 1 FROM friends 
  WHERE (
    (user_id = auth.uid() AND friend_id = pages.user_id) OR
    (friend_id = auth.uid() AND user_id = pages.user_id)
  )
);

-- Test 3: Check if user can see public pages
SELECT 'Test 3: Public pages' as test, COUNT(*) as count 
FROM pages 
WHERE visibility = 'public' 
AND user_id != auth.uid();

-- Test 4: Verify user cannot see private pages of others
SELECT 'Test 4: Private pages of others (should be 0)' as test, COUNT(*) as count 
FROM pages 
WHERE visibility = 'private' 
AND user_id != auth.uid();
*/