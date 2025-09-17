-- Comprehensive fix for friends sharing system
-- This migration addresses all identified issues with friends accessing shared pages

-- ============================================================================
-- DROP ALL EXISTING PROBLEMATIC POLICIES AND FUNCTIONS
-- ============================================================================

-- Drop existing pages policies
DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
DROP POLICY IF EXISTS "Users can view friends pages" ON pages;
DROP POLICY IF EXISTS "Users can view public pages" ON pages;
DROP POLICY IF EXISTS "Friends can view shared pages" ON pages;
DROP POLICY IF EXISTS "Allow friends to view shared pages" ON pages;
DROP POLICY IF EXISTS "Users can access friends shared pages" ON pages;

-- Drop existing functions
DROP FUNCTION IF EXISTS debug_friendship_access(UUID, UUID);
DROP FUNCTION IF EXISTS get_friend_shared_pages_direct(UUID, UUID);

-- ============================================================================
-- CREATE ROBUST RLS POLICIES WITH PROPER AUTHENTICATION HANDLING
-- ============================================================================

-- Policy 1: Users can always view their own pages
CREATE POLICY "users_own_pages_select"
ON pages FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- Policy 2: Users can view public pages from anyone
CREATE POLICY "public_pages_select"
ON pages FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND visibility = 'public'
);

-- Policy 3: CRITICAL - Friends can view pages with 'friends' visibility
-- This policy uses a more robust approach to check friendships
CREATE POLICY "friends_shared_pages_select"
ON pages FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND visibility = 'friends'
  AND (
    -- Check if current user is friends with the page owner
    EXISTS (
      SELECT 1 FROM friends f
      WHERE (
        (f.user_id = auth.uid() AND f.friend_id = pages.user_id) OR
        (f.friend_id = auth.uid() AND f.user_id = pages.user_id)
      )
    )
  )
);

-- ============================================================================
-- CREATE ENHANCED DEBUG FUNCTION WITH BETTER ERROR HANDLING
-- ============================================================================

CREATE OR REPLACE FUNCTION debug_friends_sharing_comprehensive(
  p_current_user_id UUID,
  p_friend_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  auth_user_id UUID;
  friendship_exists BOOLEAN := FALSE;
  friendship_data JSON;
  pages_data JSON;
  rls_test_result JSON;
BEGIN
  -- Get the current authenticated user
  auth_user_id := auth.uid();
  
  -- Check friendship status
  SELECT EXISTS(
    SELECT 1 FROM friends 
    WHERE (
      (user_id = p_current_user_id AND friend_id = p_friend_user_id) OR
      (friend_id = p_current_user_id AND user_id = p_friend_user_id)
    )
  ) INTO friendship_exists;
  
  -- Get friendship records
  SELECT json_agg(
    json_build_object(
      'id', id,
      'user_id', user_id,
      'friend_id', friend_id,
      'created_at', created_at
    )
  ) INTO friendship_data
  FROM friends 
  WHERE (
    (user_id = p_current_user_id AND friend_id = p_friend_user_id) OR
    (friend_id = p_current_user_id AND user_id = p_friend_user_id)
  );
  
  -- Get pages information for the friend
  SELECT json_build_object(
    'total_pages', COUNT(*),
    'friends_pages', COUNT(*) FILTER (WHERE visibility = 'friends'),
    'private_pages', COUNT(*) FILTER (WHERE visibility = 'private'),
    'public_pages', COUNT(*) FILTER (WHERE visibility = 'public'),
    'friends_pages_list', json_agg(
      json_build_object(
        'id', id,
        'title', title,
        'visibility', visibility,
        'created_at', created_at,
        'updated_at', updated_at
      )
    ) FILTER (WHERE visibility = 'friends')
  ) INTO pages_data
  FROM pages 
  WHERE user_id = p_friend_user_id;
  
  -- Test RLS policy by attempting to select friend's pages
  -- This simulates what the RLS policy would allow
  SELECT json_build_object(
    'would_rls_allow', (
      friendship_exists AND 
      EXISTS(SELECT 1 FROM pages WHERE user_id = p_friend_user_id AND visibility = 'friends')
    ),
    'rls_logic_explanation', CASE 
      WHEN NOT friendship_exists THEN 'No friendship exists between users'
      WHEN NOT EXISTS(SELECT 1 FROM pages WHERE user_id = p_friend_user_id AND visibility = 'friends') THEN 'Friend has no pages with friends visibility'
      ELSE 'RLS should allow access'
    END
  ) INTO rls_test_result;
  
  -- Build comprehensive result
  result := json_build_object(
    'debug_timestamp', now(),
    'input_parameters', json_build_object(
      'current_user_id', p_current_user_id,
      'friend_user_id', p_friend_user_id
    ),
    'authentication', json_build_object(
      'auth_uid', auth_user_id,
      'matches_current_user', (auth_user_id = p_current_user_id),
      'auth_context_valid', (auth_user_id IS NOT NULL)
    ),
    'friendship_status', json_build_object(
      'friendship_exists', friendship_exists,
      'friendship_records', COALESCE(friendship_data, '[]'::json)
    ),
    'pages_analysis', pages_data,
    'rls_analysis', rls_test_result,
    'recommendations', CASE
      WHEN auth_user_id IS NULL THEN json_build_array('User is not authenticated')
      WHEN auth_user_id != p_current_user_id THEN json_build_array('Authentication context mismatch')
      WHEN NOT friendship_exists THEN json_build_array('Users are not friends - friendship must be established first')
      WHEN NOT EXISTS(SELECT 1 FROM pages WHERE user_id = p_friend_user_id AND visibility = 'friends') THEN json_build_array('Friend has no pages with friends visibility')
      ELSE json_build_array('All conditions met - shared pages should be accessible')
    END
  );
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debug_friends_sharing_comprehensive(UUID, UUID) TO authenticated;

-- ============================================================================
-- CREATE IMPROVED FUNCTION TO GET FRIEND SHARED PAGES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_friend_shared_pages_secure(
  p_current_user_id UUID,
  p_friend_user_id UUID
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
  author_email TEXT,
  section_name TEXT,
  notebook_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user_id UUID;
  friendship_exists BOOLEAN := FALSE;
BEGIN
  -- Verify authentication context
  auth_user_id := auth.uid();
  
  -- Security check: ensure the requesting user is authenticated and matches
  IF auth_user_id IS NULL OR auth_user_id != p_current_user_id THEN
    RAISE EXCEPTION 'Authentication failed or user mismatch';
  END IF;
  
  -- Verify friendship exists
  SELECT EXISTS(
    SELECT 1 FROM friends 
    WHERE (
      (friends.user_id = p_current_user_id AND friends.friend_id = p_friend_user_id) OR
      (friends.friend_id = p_current_user_id AND friends.user_id = p_friend_user_id)
    )
  ) INTO friendship_exists;
  
  -- If no friendship, return empty result
  IF NOT friendship_exists THEN
    RETURN;
  END IF;
  
  -- Return friend's shared pages
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
    u.email as author_email,
    s.name as section_name,
    n.name as notebook_name
  FROM pages p
  LEFT JOIN users u ON p.user_id = u.id
  LEFT JOIN sections s ON p.section_id = s.id
  LEFT JOIN notebooks n ON s.notebook_id = n.id
  WHERE p.user_id = p_friend_user_id
    AND p.visibility = 'friends'
  ORDER BY p.updated_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_friend_shared_pages_secure(UUID, UUID) TO authenticated;

-- ============================================================================
-- CREATE FUNCTION TO TEST RLS POLICIES DIRECTLY
-- ============================================================================

CREATE OR REPLACE FUNCTION test_rls_friends_access(
  p_current_user_id UUID,
  p_friend_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  test_pages_count INTEGER := 0;
  auth_user_id UUID;
BEGIN
  -- Get current auth context
  auth_user_id := auth.uid();
  
  -- Temporarily set the auth context for testing
  -- Note: This is for debugging purposes only
  
  -- Count pages that should be accessible via RLS
  SELECT COUNT(*) INTO test_pages_count
  FROM pages p
  WHERE p.user_id = p_friend_user_id
    AND p.visibility = 'friends'
    AND EXISTS (
      SELECT 1 FROM friends f
      WHERE (
        (f.user_id = p_current_user_id AND f.friend_id = p.user_id) OR
        (f.friend_id = p_current_user_id AND f.user_id = p.user_id)
      )
    );
  
  result := json_build_object(
    'auth_context', json_build_object(
      'auth_uid', auth_user_id,
      'expected_user_id', p_current_user_id,
      'context_matches', (auth_user_id = p_current_user_id)
    ),
    'rls_test_result', json_build_object(
      'accessible_pages_count', test_pages_count,
      'test_timestamp', now()
    ),
    'friendship_verification', EXISTS(
      SELECT 1 FROM friends 
      WHERE (
        (user_id = p_current_user_id AND friend_id = p_friend_user_id) OR
        (friend_id = p_current_user_id AND user_id = p_friend_user_id)
      )
    )
  );
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_rls_friends_access(UUID, UUID) TO authenticated;

-- ============================================================================
-- ENSURE RLS IS PROPERLY ENABLED
-- ============================================================================

-- Ensure RLS is enabled on all relevant tables
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE SIMPLE FUNCTION TO VERIFY FRIENDSHIP STATUS
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_friendship(
  p_user1_id UUID,
  p_user2_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM friends 
    WHERE (
      (user_id = p_user1_id AND friend_id = p_user2_id) OR
      (friend_id = p_user1_id AND user_id = p_user2_id)
    )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION verify_friendship(UUID, UUID) TO authenticated;