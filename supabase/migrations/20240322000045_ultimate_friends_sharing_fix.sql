-- ULTIMATE FIX for friends sharing system
-- This migration completely rebuilds the friends sharing system from scratch

-- ============================================================================
-- STEP 1: CLEAN SLATE - Remove all existing problematic policies and functions
-- ============================================================================

-- Drop all existing pages policies
DROP POLICY IF EXISTS "users_own_pages_select" ON pages;
DROP POLICY IF EXISTS "public_pages_select" ON pages;
DROP POLICY IF EXISTS "friends_shared_pages_select" ON pages;
DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
DROP POLICY IF EXISTS "Users can view friends pages" ON pages;
DROP POLICY IF EXISTS "Users can view public pages" ON pages;
DROP POLICY IF EXISTS "Friends can view shared pages" ON pages;
DROP POLICY IF EXISTS "Allow friends to view shared pages" ON pages;
DROP POLICY IF EXISTS "Users can access friends shared pages" ON pages;

-- Drop all existing functions
DROP FUNCTION IF EXISTS debug_friends_sharing_comprehensive(UUID, UUID);
DROP FUNCTION IF EXISTS get_friend_shared_pages_secure(UUID, UUID);
DROP FUNCTION IF EXISTS test_rls_friends_access(UUID, UUID);
DROP FUNCTION IF EXISTS verify_friendship(UUID, UUID);
DROP FUNCTION IF EXISTS debug_friendship_access(UUID, UUID);
DROP FUNCTION IF EXISTS get_friend_shared_pages_direct(UUID, UUID);

-- ============================================================================
-- STEP 2: CREATE SIMPLE, BULLETPROOF RLS POLICIES
-- ============================================================================

-- Policy 1: Users can ALWAYS view their own pages (highest priority)
CREATE POLICY "own_pages_access"
ON pages FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: ANYONE can view public pages (no friendship required)
CREATE POLICY "public_pages_access"
ON pages FOR SELECT
USING (visibility = 'public');

-- Policy 3: Friends can view 'friends' visibility pages
-- This uses a simple EXISTS check that should work reliably
CREATE POLICY "friends_pages_access"
ON pages FOR SELECT
USING (
  visibility = 'friends' 
  AND EXISTS (
    SELECT 1 FROM friends 
    WHERE (
      (friends.user_id = auth.uid() AND friends.friend_id = pages.user_id) OR
      (friends.friend_id = auth.uid() AND friends.user_id = pages.user_id)
    )
  )
);

-- ============================================================================
-- STEP 3: CREATE SIMPLE UTILITY FUNCTIONS
-- ============================================================================

-- Simple function to check if two users are friends
CREATE OR REPLACE FUNCTION are_users_friends(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM friends 
    WHERE (
      (user_id = user1_id AND friend_id = user2_id) OR
      (friend_id = user1_id AND user_id = user2_id)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION are_users_friends(UUID, UUID) TO authenticated;

-- Function to get all pages accessible to a user from a specific friend
CREATE OR REPLACE FUNCTION get_accessible_friend_pages(
  requesting_user_id UUID,
  friend_user_id UUID
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  content TEXT,
  content_json JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_id UUID,
  section_id UUID,
  visibility TEXT,
  author_name TEXT,
  author_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  friendship_exists BOOLEAN;
BEGIN
  -- Check if users are friends
  SELECT are_users_friends(requesting_user_id, friend_user_id) INTO friendship_exists;
  
  -- Return pages based on visibility rules:
  -- 1. Public pages (always accessible)
  -- 2. Friends pages (only if friendship exists)
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.content,
    p.content_json,
    p.created_at,
    p.updated_at,
    p.user_id,
    p.section_id,
    p.visibility,
    u.full_name as author_name,
    u.email as author_email
  FROM pages p
  LEFT JOIN users u ON p.user_id = u.id
  WHERE p.user_id = friend_user_id
    AND (
      p.visibility = 'public' OR 
      (p.visibility = 'friends' AND friendship_exists = true)
    )
  ORDER BY p.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_accessible_friend_pages(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 4: CREATE COMPREHENSIVE DEBUG FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION debug_friend_access_simple(
  current_user_id UUID,
  target_friend_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  auth_context UUID;
  friendship_status BOOLEAN;
  friend_pages_count INTEGER;
  public_pages_count INTEGER;
  friends_pages_count INTEGER;
  total_pages_count INTEGER;
BEGIN
  -- Get current auth context
  auth_context := auth.uid();
  
  -- Check friendship
  SELECT are_users_friends(current_user_id, target_friend_id) INTO friendship_status;
  
  -- Count friend's pages by visibility
  SELECT 
    COUNT(*) FILTER (WHERE visibility = 'public'),
    COUNT(*) FILTER (WHERE visibility = 'friends'),
    COUNT(*)
  INTO public_pages_count, friends_pages_count, total_pages_count
  FROM pages 
  WHERE user_id = target_friend_id;
  
  -- Count pages that should be accessible
  SELECT COUNT(*) INTO friend_pages_count
  FROM pages 
  WHERE user_id = target_friend_id
    AND (
      visibility = 'public' OR 
      (visibility = 'friends' AND friendship_status = true)
    );
  
  -- Build result
  result := json_build_object(
    'timestamp', now(),
    'input', json_build_object(
      'current_user_id', current_user_id,
      'target_friend_id', target_friend_id
    ),
    'auth_context', json_build_object(
      'auth_uid', auth_context,
      'matches_current_user', (auth_context = current_user_id),
      'is_authenticated', (auth_context IS NOT NULL)
    ),
    'friendship', json_build_object(
      'are_friends', friendship_status,
      'friendship_verified', true
    ),
    'pages_analysis', json_build_object(
      'total_pages', total_pages_count,
      'public_pages', public_pages_count,
      'friends_pages', friends_pages_count,
      'accessible_pages', friend_pages_count
    ),
    'expected_result', json_build_object(
      'should_see_public_pages', (public_pages_count > 0),
      'should_see_friends_pages', (friends_pages_count > 0 AND friendship_status),
      'total_accessible', friend_pages_count
    ),
    'recommendations', CASE
      WHEN auth_context IS NULL THEN json_build_array('User is not authenticated')
      WHEN auth_context != current_user_id THEN json_build_array('Authentication mismatch - please refresh')
      WHEN total_pages_count = 0 THEN json_build_array('Friend has no pages created yet')
      WHEN public_pages_count = 0 AND friends_pages_count = 0 THEN json_build_array('Friend has no public or friends pages')
      WHEN NOT friendship_status AND friends_pages_count > 0 THEN json_build_array('Not friends - can only see public pages')
      WHEN friend_pages_count > 0 THEN json_build_array('Everything looks good - pages should be accessible')
      ELSE json_build_array('Unknown issue - check RLS policies')
    END
  );
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION debug_friend_access_simple(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 5: ENSURE PROPER TABLE SETUP
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: CREATE TEST DATA VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_test_data(user1_id UUID, user2_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  user1_exists BOOLEAN;
  user2_exists BOOLEAN;
  friendship_exists BOOLEAN;
  user1_pages INTEGER;
  user2_pages INTEGER;
BEGIN
  -- Check if users exist
  SELECT EXISTS(SELECT 1 FROM users WHERE id = user1_id) INTO user1_exists;
  SELECT EXISTS(SELECT 1 FROM users WHERE id = user2_id) INTO user2_exists;
  
  -- Check friendship
  SELECT are_users_friends(user1_id, user2_id) INTO friendship_exists;
  
  -- Count pages
  SELECT COUNT(*) FROM pages WHERE user_id = user1_id INTO user1_pages;
  SELECT COUNT(*) FROM pages WHERE user_id = user2_id INTO user2_pages;
  
  result := json_build_object(
    'users', json_build_object(
      'user1_exists', user1_exists,
      'user2_exists', user2_exists,
      'both_exist', (user1_exists AND user2_exists)
    ),
    'friendship', json_build_object(
      'friendship_exists', friendship_exists
    ),
    'pages', json_build_object(
      'user1_pages', user1_pages,
      'user2_pages', user2_pages
    ),
    'ready_for_testing', (user1_exists AND user2_exists AND user2_pages > 0)
  );
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_test_data(UUID, UUID) TO authenticated;