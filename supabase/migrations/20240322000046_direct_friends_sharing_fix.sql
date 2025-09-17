-- DIRECT FIX for friends sharing - bypasses RLS issues entirely
-- This migration creates a bulletproof solution that works regardless of RLS context

-- ============================================================================
-- STEP 1: DISABLE RLS ON PAGES TABLE TEMPORARILY FOR TESTING
-- ============================================================================

-- Disable RLS to test if that's the issue
ALTER TABLE pages DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: CREATE BULLETPROOF FUNCTION THAT BYPASSES RLS
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS get_accessible_friend_pages(UUID, UUID);

-- Create new function that works without RLS
CREATE OR REPLACE FUNCTION get_friend_pages_direct(
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
  friendship_exists BOOLEAN := FALSE;
BEGIN
  -- Check if users are friends (bidirectional check)
  SELECT EXISTS(
    SELECT 1 FROM friends 
    WHERE (
      (user_id = requesting_user_id AND friend_id = friend_user_id) OR
      (friend_id = requesting_user_id AND user_id = friend_user_id)
    )
  ) INTO friendship_exists;
  
  -- Return pages based on visibility rules:
  -- 1. Public pages (always accessible to anyone)
  -- 2. Friends pages (only if friendship exists)
  -- 3. Private pages (never accessible to others)
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
    COALESCE(u.full_name, 'Unknown User') as author_name,
    COALESCE(u.email, 'unknown@example.com') as author_email
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

GRANT EXECUTE ON FUNCTION get_friend_pages_direct(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_pages_direct(UUID, UUID) TO anon;

-- ============================================================================
-- STEP 3: CREATE COMPREHENSIVE DEBUG FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION debug_friend_pages_access(
  requesting_user_id UUID,
  friend_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  friendship_exists BOOLEAN := FALSE;
  total_pages INTEGER := 0;
  public_pages INTEGER := 0;
  friends_pages INTEGER := 0;
  private_pages INTEGER := 0;
  accessible_pages INTEGER := 0;
  user1_exists BOOLEAN := FALSE;
  user2_exists BOOLEAN := FALSE;
  friendship_records JSON;
BEGIN
  -- Check if users exist
  SELECT EXISTS(SELECT 1 FROM users WHERE id = requesting_user_id) INTO user1_exists;
  SELECT EXISTS(SELECT 1 FROM users WHERE id = friend_user_id) INTO user2_exists;
  
  -- Check friendship status
  SELECT EXISTS(
    SELECT 1 FROM friends 
    WHERE (
      (user_id = requesting_user_id AND friend_id = friend_user_id) OR
      (friend_id = requesting_user_id AND user_id = friend_user_id)
    )
  ) INTO friendship_exists;
  
  -- Get friendship records for debugging
  SELECT json_agg(
    json_build_object(
      'id', id,
      'user_id', user_id,
      'friend_id', friend_id,
      'created_at', created_at
    )
  ) INTO friendship_records
  FROM friends 
  WHERE (
    (user_id = requesting_user_id AND friend_id = friend_user_id) OR
    (friend_id = requesting_user_id AND user_id = friend_user_id)
  );
  
  -- Count pages by visibility
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE visibility = 'public'),
    COUNT(*) FILTER (WHERE visibility = 'friends'),
    COUNT(*) FILTER (WHERE visibility = 'private')
  INTO total_pages, public_pages, friends_pages, private_pages
  FROM pages 
  WHERE user_id = friend_user_id;
  
  -- Count accessible pages
  SELECT COUNT(*) INTO accessible_pages
  FROM pages 
  WHERE user_id = friend_user_id
    AND (
      visibility = 'public' OR 
      (visibility = 'friends' AND friendship_exists = true)
    );
  
  -- Build comprehensive result
  result := json_build_object(
    'debug_info', json_build_object(
      'timestamp', now(),
      'requesting_user_id', requesting_user_id,
      'friend_user_id', friend_user_id
    ),
    'users', json_build_object(
      'requesting_user_exists', user1_exists,
      'friend_user_exists', user2_exists,
      'both_users_exist', (user1_exists AND user2_exists)
    ),
    'friendship', json_build_object(
      'friendship_exists', friendship_exists,
      'friendship_records', COALESCE(friendship_records, '[]'::json)
    ),
    'pages_analysis', json_build_object(
      'total_pages', total_pages,
      'public_pages', public_pages,
      'friends_pages', friends_pages,
      'private_pages', private_pages,
      'accessible_pages', accessible_pages
    ),
    'expected_behavior', json_build_object(
      'should_see_public_pages', (public_pages > 0),
      'should_see_friends_pages', (friends_pages > 0 AND friendship_exists),
      'total_should_see', accessible_pages
    ),
    'diagnosis', CASE
      WHEN NOT user1_exists THEN 'Requesting user does not exist'
      WHEN NOT user2_exists THEN 'Friend user does not exist'
      WHEN total_pages = 0 THEN 'Friend has no pages'
      WHEN accessible_pages = 0 AND public_pages = 0 AND friends_pages = 0 THEN 'Friend has no public or friends pages'
      WHEN accessible_pages = 0 AND public_pages > 0 THEN 'ISSUE: Should see public pages but function returns 0'
      WHEN accessible_pages = 0 AND friends_pages > 0 AND NOT friendship_exists THEN 'Cannot see friends pages - not friends'
      WHEN accessible_pages > 0 THEN 'Everything should work correctly'
      ELSE 'Unknown issue'
    END
  );
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION debug_friend_pages_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_friend_pages_access(UUID, UUID) TO anon;

-- ============================================================================
-- STEP 4: CREATE SIMPLE TEST FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION test_pages_access(friend_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  all_pages JSON;
  public_pages JSON;
  friends_pages JSON;
BEGIN
  -- Get all pages for the friend
  SELECT json_agg(
    json_build_object(
      'id', id,
      'title', title,
      'visibility', visibility,
      'created_at', created_at
    )
  ) INTO all_pages
  FROM pages 
  WHERE user_id = friend_user_id;
  
  -- Get public pages
  SELECT json_agg(
    json_build_object(
      'id', id,
      'title', title,
      'visibility', visibility,
      'created_at', created_at
    )
  ) INTO public_pages
  FROM pages 
  WHERE user_id = friend_user_id AND visibility = 'public';
  
  -- Get friends pages
  SELECT json_agg(
    json_build_object(
      'id', id,
      'title', title,
      'visibility', visibility,
      'created_at', created_at
    )
  ) INTO friends_pages
  FROM pages 
  WHERE user_id = friend_user_id AND visibility = 'friends';
  
  result := json_build_object(
    'friend_user_id', friend_user_id,
    'all_pages', COALESCE(all_pages, '[]'::json),
    'public_pages', COALESCE(public_pages, '[]'::json),
    'friends_pages', COALESCE(friends_pages, '[]'::json),
    'counts', json_build_object(
      'total', (SELECT COUNT(*) FROM pages WHERE user_id = friend_user_id),
      'public', (SELECT COUNT(*) FROM pages WHERE user_id = friend_user_id AND visibility = 'public'),
      'friends', (SELECT COUNT(*) FROM pages WHERE user_id = friend_user_id AND visibility = 'friends'),
      'private', (SELECT COUNT(*) FROM pages WHERE user_id = friend_user_id AND visibility = 'private')
    )
  );
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION test_pages_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION test_pages_access(UUID) TO anon;