-- FINAL FIX for friends sharing - ensure all database functions work correctly
-- This migration creates simple, reliable functions for friends sharing

-- ============================================================================
-- STEP 1: ENSURE TABLES HAVE PROPER STRUCTURE
-- ============================================================================

-- Make sure pages table has visibility column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'pages' AND column_name = 'visibility') THEN
        ALTER TABLE pages ADD COLUMN visibility TEXT DEFAULT 'private';
    END IF;
END $$;

-- Create index on visibility for better performance
CREATE INDEX IF NOT EXISTS idx_pages_visibility ON pages(visibility);
CREATE INDEX IF NOT EXISTS idx_pages_user_visibility ON pages(user_id, visibility);

-- ============================================================================
-- STEP 2: CREATE SIMPLE, WORKING DATABASE FUNCTIONS
-- ============================================================================

-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS get_friend_pages_direct(UUID, UUID);
DROP FUNCTION IF EXISTS debug_friend_pages_access(UUID, UUID);
DROP FUNCTION IF EXISTS test_pages_access(UUID);

-- Simple function to get friend's shared pages
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
    COALESCE(p.visibility, 'private') as visibility,
    COALESCE(u.full_name, 'Unknown User') as author_name,
    COALESCE(u.email, 'unknown@example.com') as author_email
  FROM pages p
  LEFT JOIN users u ON p.user_id = u.id
  WHERE p.user_id = friend_user_id
    AND (
      COALESCE(p.visibility, 'private') = 'public' OR 
      (COALESCE(p.visibility, 'private') = 'friends' AND friendship_exists = true)
    )
  ORDER BY p.updated_at DESC NULLS LAST;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_friend_pages_direct(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_pages_direct(UUID, UUID) TO anon;

-- Debug function to analyze friend access
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
  
  -- Count pages by visibility
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE COALESCE(visibility, 'private') = 'public'),
    COUNT(*) FILTER (WHERE COALESCE(visibility, 'private') = 'friends'),
    COUNT(*) FILTER (WHERE COALESCE(visibility, 'private') = 'private')
  INTO total_pages, public_pages, friends_pages, private_pages
  FROM pages 
  WHERE user_id = friend_user_id;
  
  -- Count accessible pages
  SELECT COUNT(*) INTO accessible_pages
  FROM pages 
  WHERE user_id = friend_user_id
    AND (
      COALESCE(visibility, 'private') = 'public' OR 
      (COALESCE(visibility, 'private') = 'friends' AND friendship_exists = true)
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
      'friendship_exists', friendship_exists
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

-- Simple test function to check pages access
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
      'visibility', COALESCE(visibility, 'private'),
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
      'visibility', COALESCE(visibility, 'private'),
      'created_at', created_at
    )
  ) INTO public_pages
  FROM pages 
  WHERE user_id = friend_user_id AND COALESCE(visibility, 'private') = 'public';
  
  -- Get friends pages
  SELECT json_agg(
    json_build_object(
      'id', id,
      'title', title,
      'visibility', COALESCE(visibility, 'private'),
      'created_at', created_at
    )
  ) INTO friends_pages
  FROM pages 
  WHERE user_id = friend_user_id AND COALESCE(visibility, 'private') = 'friends';
  
  result := json_build_object(
    'friend_user_id', friend_user_id,
    'all_pages', COALESCE(all_pages, '[]'::json),
    'public_pages', COALESCE(public_pages, '[]'::json),
    'friends_pages', COALESCE(friends_pages, '[]'::json),
    'counts', json_build_object(
      'total', (SELECT COUNT(*) FROM pages WHERE user_id = friend_user_id),
      'public', (SELECT COUNT(*) FROM pages WHERE user_id = friend_user_id AND COALESCE(visibility, 'private') = 'public'),
      'friends', (SELECT COUNT(*) FROM pages WHERE user_id = friend_user_id AND COALESCE(visibility, 'private') = 'friends'),
      'private', (SELECT COUNT(*) FROM pages WHERE user_id = friend_user_id AND COALESCE(visibility, 'private') = 'private')
    )
  );
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION test_pages_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION test_pages_access(UUID) TO anon;

-- ============================================================================
-- STEP 3: ENSURE RLS IS PROPERLY CONFIGURED
-- ============================================================================

-- Enable RLS on pages table
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "own_pages_access" ON pages;
DROP POLICY IF EXISTS "public_pages_access" ON pages;
DROP POLICY IF EXISTS "friends_pages_access" ON pages;

-- Create simple, working RLS policies
CREATE POLICY "own_pages_access"
ON pages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "public_pages_access"
ON pages FOR SELECT
USING (COALESCE(visibility, 'private') = 'public');

CREATE POLICY "friends_pages_access"
ON pages FOR SELECT
USING (
  COALESCE(visibility, 'private') = 'friends' 
  AND EXISTS (
    SELECT 1 FROM friends 
    WHERE (
      (friends.user_id = auth.uid() AND friends.friend_id = pages.user_id) OR
      (friends.friend_id = auth.uid() AND friends.user_id = pages.user_id)
    )
  )
);

-- ============================================================================
-- STEP 4: CREATE HELPER FUNCTION FOR TESTING
-- ============================================================================

-- Function to create test data for debugging
CREATE OR REPLACE FUNCTION create_test_shared_page(
  owner_user_id UUID,
  page_title TEXT DEFAULT 'Test Shared Page',
  page_visibility TEXT DEFAULT 'public'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_page_id UUID;
BEGIN
  INSERT INTO pages (user_id, title, content, visibility, created_at, updated_at)
  VALUES (
    owner_user_id,
    page_title,
    'This is a test page for debugging friends sharing functionality.',
    page_visibility,
    now(),
    now()
  )
  RETURNING id INTO new_page_id;
  
  RETURN new_page_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_test_shared_page(UUID, TEXT, TEXT) TO authenticated;