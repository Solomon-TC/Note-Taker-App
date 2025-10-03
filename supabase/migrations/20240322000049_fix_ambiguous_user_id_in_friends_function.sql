-- Fix ambiguous user_id column reference in get_friend_pages_direct function
-- This migration fixes the "column reference 'user_id' is ambiguous" error

-- ============================================================================
-- STEP 1: Drop and recreate the get_friend_pages_direct function with proper aliases
-- ============================================================================

DROP FUNCTION IF EXISTS get_friend_pages_direct(UUID, UUID);

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
  -- CRITICAL: Check if users are actually friends (bidirectional check)
  -- Use explicit table alias 'f' for friends table
  SELECT EXISTS(
    SELECT 1 FROM friends f
    WHERE (
      (f.user_id = requesting_user_id AND f.friend_id = friend_user_id) 
      OR
      (f.friend_id = requesting_user_id AND f.user_id = friend_user_id)
    )
  ) INTO friendship_exists;
  
  -- Log for debugging
  RAISE NOTICE 'Friendship check: requesting_user=%, friend_user=%, friendship_exists=%', 
    requesting_user_id, friend_user_id, friendship_exists;
  
  -- Return pages based on visibility rules
  -- Use explicit table aliases: p for pages, u for users
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.content,
    p.content_json,
    p.created_at,
    p.updated_at,
    p.user_id,  -- This is now clearly from pages table
    p.section_id,
    COALESCE(p.visibility, 'private') as visibility,
    COALESCE(u.full_name, 'Unknown User') as author_name,
    COALESCE(u.email, 'unknown@example.com') as author_email
  FROM pages p
  LEFT JOIN users u ON p.user_id = u.id  -- Explicitly qualify both sides
  WHERE p.user_id = friend_user_id  -- Explicitly use p.user_id
    AND (
      -- Public pages are always visible
      COALESCE(p.visibility, 'private') = 'public' 
      OR 
      -- Friends pages are only visible if friendship exists
      (COALESCE(p.visibility, 'private') = 'friends' AND friendship_exists = true)
    )
  ORDER BY p.updated_at DESC NULLS LAST;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_friend_pages_direct(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_pages_direct(UUID, UUID) TO anon;

-- ============================================================================
-- STEP 2: Fix the are_users_friends helper function
-- ============================================================================

DROP FUNCTION IF EXISTS are_users_friends(UUID, UUID);

CREATE OR REPLACE FUNCTION are_users_friends(
  user1_id UUID,
  user2_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  friendship_exists BOOLEAN := FALSE;
BEGIN
  -- Use explicit table alias 'f' for friends table
  SELECT EXISTS(
    SELECT 1 FROM friends f
    WHERE (
      (f.user_id = user1_id AND f.friend_id = user2_id) 
      OR
      (f.friend_id = user1_id AND f.user_id = user2_id)
    )
  ) INTO friendship_exists;
  
  RETURN friendship_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION are_users_friends(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION are_users_friends(UUID, UUID) TO anon;

-- ============================================================================
-- STEP 3: Fix the debug_friends_sharing function
-- ============================================================================

DROP FUNCTION IF EXISTS debug_friends_sharing(UUID, UUID);

CREATE OR REPLACE FUNCTION debug_friends_sharing(
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
BEGIN
  -- Check friendship
  SELECT are_users_friends(requesting_user_id, friend_user_id) INTO friendship_exists;
  
  -- Count pages by visibility - use explicit table alias 'p'
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE COALESCE(p.visibility, 'private') = 'public'),
    COUNT(*) FILTER (WHERE COALESCE(p.visibility, 'private') = 'friends'),
    COUNT(*) FILTER (WHERE COALESCE(p.visibility, 'private') = 'private')
  INTO total_pages, public_pages, friends_pages, private_pages
  FROM pages p
  WHERE p.user_id = friend_user_id;
  
  -- Count accessible pages - use explicit table alias 'p'
  SELECT COUNT(*) INTO accessible_pages
  FROM pages p
  WHERE p.user_id = friend_user_id
    AND (
      COALESCE(p.visibility, 'private') = 'public' 
      OR 
      (COALESCE(p.visibility, 'private') = 'friends' AND friendship_exists = true)
    );
  
  -- Build result
  result := json_build_object(
    'requesting_user_id', requesting_user_id,
    'friend_user_id', friend_user_id,
    'friendship_exists', friendship_exists,
    'pages_summary', json_build_object(
      'total', total_pages,
      'public', public_pages,
      'friends', friends_pages,
      'private', private_pages,
      'accessible', accessible_pages
    ),
    'diagnosis', CASE
      WHEN NOT friendship_exists THEN 'Users are not friends - cannot see friends-only pages'
      WHEN total_pages = 0 THEN 'Friend has no pages'
      WHEN accessible_pages = 0 THEN 'Friend has no public or friends-visible pages'
      WHEN accessible_pages > 0 THEN 'Everything is working correctly'
      ELSE 'Unknown issue'
    END
  );
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION debug_friends_sharing(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_friends_sharing(UUID, UUID) TO anon;

-- ============================================================================
-- STEP 4: Update RLS policies with explicit table references
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
DROP POLICY IF EXISTS "Users can view public pages" ON pages;
DROP POLICY IF EXISTS "Users can view friends' shared pages" ON pages;

-- Policy 1: Users can always view their own pages (any visibility)
CREATE POLICY "Users can view their own pages"
ON pages FOR SELECT
USING (auth.uid() = pages.user_id);

-- Policy 2: Users can view public pages from anyone
CREATE POLICY "Users can view public pages"
ON pages FOR SELECT
USING (pages.visibility = 'public');

-- Policy 3: Users can view pages with 'friends' visibility if they are friends with the page owner
-- Use explicit table aliases to avoid ambiguity
CREATE POLICY "Users can view friends' shared pages"
ON pages FOR SELECT
USING (
  pages.visibility = 'friends' 
  AND EXISTS (
    SELECT 1 FROM friends f
    WHERE (
      (f.user_id = auth.uid() AND f.friend_id = pages.user_id)
      OR
      (f.friend_id = auth.uid() AND f.user_id = pages.user_id)
    )
  )
);
