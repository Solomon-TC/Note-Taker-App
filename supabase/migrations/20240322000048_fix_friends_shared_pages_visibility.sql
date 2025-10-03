-- Fix friends shared pages visibility
-- This migration ensures the RLS policies and database functions work correctly together

-- ============================================================================
-- STEP 1: Verify and fix the pages table structure
-- ============================================================================

-- Ensure visibility column exists and has correct default
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'pages' AND column_name = 'visibility') THEN
        ALTER TABLE pages ADD COLUMN visibility TEXT DEFAULT 'private';
    END IF;
END $$;

-- Update any NULL visibility values to 'private'
UPDATE pages SET visibility = 'private' WHERE visibility IS NULL;

-- ============================================================================
-- STEP 2: Drop and recreate the RLS policies with correct logic
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "own_pages_access" ON pages;
DROP POLICY IF EXISTS "public_pages_access" ON pages;
DROP POLICY IF EXISTS "friends_pages_access" ON pages;
DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
DROP POLICY IF EXISTS "Users can view public pages" ON pages;
DROP POLICY IF EXISTS "Users can view friends' shared pages" ON pages;

-- Policy 1: Users can always view their own pages (any visibility)
CREATE POLICY "Users can view their own pages"
ON pages FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Users can view public pages from anyone
CREATE POLICY "Users can view public pages"
ON pages FOR SELECT
USING (visibility = 'public');

-- Policy 3: Users can view pages with 'friends' visibility if they are friends with the page owner
CREATE POLICY "Users can view friends' shared pages"
ON pages FOR SELECT
USING (
  visibility = 'friends' 
  AND EXISTS (
    SELECT 1 FROM friends
    WHERE (
      (friends.user_id = auth.uid() AND friends.friend_id = pages.user_id)
      OR
      (friends.friend_id = auth.uid() AND friends.user_id = pages.user_id)
    )
  )
);

-- ============================================================================
-- STEP 3: Update the database function to work with RLS
-- ============================================================================

-- Drop the existing function
DROP FUNCTION IF EXISTS get_friend_pages_direct(UUID, UUID);

-- Create a new version that properly checks friendship and visibility
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
  SELECT EXISTS(
    SELECT 1 FROM friends 
    WHERE (
      (user_id = requesting_user_id AND friend_id = friend_user_id) 
      OR
      (friend_id = requesting_user_id AND user_id = friend_user_id)
    )
  ) INTO friendship_exists;
  
  -- Log for debugging
  RAISE NOTICE 'Friendship check: requesting_user=%, friend_user=%, friendship_exists=%', 
    requesting_user_id, friend_user_id, friendship_exists;
  
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
    COALESCE(p.visibility, 'private') as visibility,
    COALESCE(u.full_name, 'Unknown User') as author_name,
    COALESCE(u.email, 'unknown@example.com') as author_email
  FROM pages p
  LEFT JOIN users u ON p.user_id = u.id
  WHERE p.user_id = friend_user_id
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
-- STEP 4: Create a helper function to check friendship status
-- ============================================================================

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
  SELECT EXISTS(
    SELECT 1 FROM friends 
    WHERE (
      (user_id = user1_id AND friend_id = user2_id) 
      OR
      (friend_id = user1_id AND user_id = user2_id)
    )
  ) INTO friendship_exists;
  
  RETURN friendship_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION are_users_friends(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION are_users_friends(UUID, UUID) TO anon;

-- ============================================================================
-- STEP 5: Create a comprehensive debug function
-- ============================================================================

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
      COALESCE(visibility, 'private') = 'public' 
      OR 
      (COALESCE(visibility, 'private') = 'friends' AND friendship_exists = true)
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
-- STEP 6: Ensure indexes exist for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pages_visibility ON pages(visibility);
CREATE INDEX IF NOT EXISTS idx_pages_user_visibility ON pages(user_id, visibility);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_both_ids ON friends(user_id, friend_id);
