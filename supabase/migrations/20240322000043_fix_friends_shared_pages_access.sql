-- Fix friends shared pages access
-- This migration ensures that friends can properly access each other's shared pages

-- ============================================================================
-- DROP EXISTING PROBLEMATIC POLICIES
-- ============================================================================

-- Drop existing pages policies that might be blocking friends access
DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
DROP POLICY IF EXISTS "Users can view friends pages" ON pages;
DROP POLICY IF EXISTS "Users can view public pages" ON pages;
DROP POLICY IF EXISTS "Friends can view shared pages" ON pages;
DROP POLICY IF EXISTS "Allow friends to view shared pages" ON pages;
DROP POLICY IF EXISTS "Users can access friends shared pages" ON pages;

-- ============================================================================
-- CREATE COMPREHENSIVE PAGES RLS POLICIES
-- ============================================================================

-- Policy 1: Users can always view their own pages
CREATE POLICY "Users can view their own pages"
ON pages FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Users can view public pages from anyone
CREATE POLICY "Users can view public pages"
ON pages FOR SELECT
USING (visibility = 'public');

-- Policy 3: CRITICAL - Friends can view pages with 'friends' visibility
CREATE POLICY "Friends can view shared pages"
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
-- CREATE HELPER FUNCTION FOR DEBUGGING FRIENDS ACCESS
-- ============================================================================

CREATE OR REPLACE FUNCTION debug_friendship_access(
  p_current_user_id UUID,
  p_page_owner_id UUID
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
          (user_id = p_current_user_id AND friend_id = p_page_owner_id) OR
          (friend_id = p_current_user_id AND user_id = p_page_owner_id)
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
          (user_id = p_current_user_id AND friend_id = p_page_owner_id) OR
          (friend_id = p_current_user_id AND user_id = p_page_owner_id)
        )
      ) as friendship_records
  ),
  pages_check AS (
    SELECT 
      COUNT(*) as total_pages,
      COUNT(*) FILTER (WHERE visibility = 'friends') as friends_pages,
      COUNT(*) FILTER (WHERE visibility = 'private') as private_pages,
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
    WHERE user_id = p_page_owner_id
  )
  SELECT json_build_object(
    'debug_info', json_build_object(
      'current_user_id', p_current_user_id,
      'page_owner_id', p_page_owner_id,
      'timestamp', now()
    ),
    'friendship', (SELECT row_to_json(friendship_check) FROM friendship_check),
    'pages', (SELECT row_to_json(pages_check) FROM pages_check),
    'rls_should_allow_access', (
      SELECT friendship_exists AND friends_pages > 0 
      FROM friendship_check, pages_check
    )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debug_friendship_access(UUID, UUID) TO authenticated;

-- ============================================================================
-- CREATE FUNCTION TO GET FRIEND SHARED PAGES (BYPASSES RLS FOR TESTING)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_friend_shared_pages_direct(
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
LANGUAGE SQL
SECURITY DEFINER
AS $$
  -- First verify friendship exists
  WITH friendship_verified AS (
    SELECT EXISTS(
      SELECT 1 FROM friends 
      WHERE (
        (friends.user_id = p_current_user_id AND friends.friend_id = p_friend_user_id) OR
        (friends.friend_id = p_current_user_id AND friends.user_id = p_friend_user_id)
      )
    ) as are_friends
  )
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
  CROSS JOIN friendship_verified fv
  WHERE p.user_id = p_friend_user_id
    AND p.visibility = 'friends'
    AND fv.are_friends = true
  ORDER BY p.updated_at DESC;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_friend_shared_pages_direct(UUID, UUID) TO authenticated;

-- ============================================================================
-- VERIFY RLS IS ENABLED ON PAGES TABLE
-- ============================================================================

-- Ensure RLS is enabled on pages table
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;