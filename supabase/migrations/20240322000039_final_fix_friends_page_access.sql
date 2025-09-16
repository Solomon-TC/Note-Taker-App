-- Final Fix for Friends Page Access Issue
-- This migration addresses the specific issue with friends not being able to see shared pages

-- ============================================================================
-- DIAGNOSE AND FIX THE FRIENDS PAGE ACCESS ISSUE
-- ============================================================================

-- First, let's create a function to test the exact RLS logic
CREATE OR REPLACE FUNCTION test_friends_rls_logic(
  p_current_user_id UUID,
  p_page_owner_id UUID,
  p_page_visibility TEXT
)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'current_user_id', p_current_user_id,
    'page_owner_id', p_page_owner_id,
    'page_visibility', p_page_visibility,
    'is_not_owner', p_current_user_id != p_page_owner_id,
    'visibility_is_friends', p_page_visibility = 'friends',
    'friendship_exists', EXISTS(
      SELECT 1 FROM friends 
      WHERE (
        (user_id = p_current_user_id AND friend_id = p_page_owner_id) OR
        (friend_id = p_current_user_id AND user_id = p_page_owner_id)
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
        (user_id = p_current_user_id AND friend_id = p_page_owner_id) OR
        (friend_id = p_current_user_id AND user_id = p_page_owner_id)
      )
    ),
    'should_have_access', (
      p_page_visibility = 'friends' AND
      p_current_user_id != p_page_owner_id AND
      EXISTS(
        SELECT 1 FROM friends 
        WHERE (
          (user_id = p_current_user_id AND friend_id = p_page_owner_id) OR
          (friend_id = p_current_user_id AND user_id = p_page_owner_id)
        )
      )
    )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_friends_rls_logic(UUID, UUID, TEXT) TO authenticated;

-- ============================================================================
-- REBUILD THE FRIENDS PAGE ACCESS POLICY WITH BETTER LOGIC
-- ============================================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Friends can read shared pages" ON pages;

-- Create a new, more explicit policy for friends page access
CREATE POLICY "Friends can read shared pages"
ON pages FOR SELECT
USING (
  -- Page must be set to friends visibility
  visibility = 'friends' AND
  -- Current user must not be the page owner (to avoid conflict with owner policy)
  auth.uid() != user_id AND
  -- Must have a friendship relationship (bidirectional check)
  EXISTS (
    SELECT 1 FROM friends 
    WHERE (
      (user_id = auth.uid() AND friend_id = pages.user_id) OR
      (friend_id = auth.uid() AND user_id = pages.user_id)
    )
  )
);

-- ============================================================================
-- CREATE A SIMPLER TEST FUNCTION FOR DEBUGGING
-- ============================================================================

-- Function to directly test if a user can access a specific page
CREATE OR REPLACE FUNCTION can_user_access_page(
  p_page_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH page_info AS (
    SELECT 
      id,
      title,
      user_id as owner_id,
      visibility,
      created_at
    FROM pages 
    WHERE id = p_page_id
  )
  SELECT json_build_object(
    'page_id', p_page_id,
    'test_user_id', p_user_id,
    'page_exists', EXISTS(SELECT 1 FROM page_info),
    'page_owner_id', (SELECT owner_id FROM page_info),
    'page_visibility', (SELECT visibility FROM page_info),
    'is_owner', (SELECT owner_id FROM page_info) = p_user_id,
    'friendship_exists', (
      CASE 
        WHEN (SELECT owner_id FROM page_info) = p_user_id THEN null
        ELSE EXISTS(
          SELECT 1 FROM friends 
          WHERE (
            (user_id = p_user_id AND friend_id = (SELECT owner_id FROM page_info)) OR
            (friend_id = p_user_id AND user_id = (SELECT owner_id FROM page_info))
          )
        )
      END
    ),
    'access_reason', (
      CASE 
        WHEN NOT EXISTS(SELECT 1 FROM page_info) THEN 'page_not_found'
        WHEN (SELECT owner_id FROM page_info) = p_user_id THEN 'owner'
        WHEN (SELECT visibility FROM page_info) = 'public' THEN 'public'
        WHEN (SELECT visibility FROM page_info) = 'private' THEN 'private_no_access'
        WHEN (SELECT visibility FROM page_info) = 'friends' AND EXISTS(
          SELECT 1 FROM friends 
          WHERE (
            (user_id = p_user_id AND friend_id = (SELECT owner_id FROM page_info)) OR
            (friend_id = p_user_id AND user_id = (SELECT owner_id FROM page_info))
          )
        ) THEN 'friend_access'
        WHEN (SELECT visibility FROM page_info) = 'friends' THEN 'friends_no_friendship'
        ELSE 'unknown'
      END
    ),
    'should_have_access', (
      CASE 
        WHEN NOT EXISTS(SELECT 1 FROM page_info) THEN false
        WHEN (SELECT owner_id FROM page_info) = p_user_id THEN true
        WHEN (SELECT visibility FROM page_info) = 'public' THEN true
        WHEN (SELECT visibility FROM page_info) = 'friends' AND EXISTS(
          SELECT 1 FROM friends 
          WHERE (
            (user_id = p_user_id AND friend_id = (SELECT owner_id FROM page_info)) OR
            (friend_id = p_user_id AND user_id = (SELECT owner_id FROM page_info))
          )
        ) THEN true
        ELSE false
      END
    )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_user_access_page(UUID, UUID) TO authenticated;

-- ============================================================================
-- CREATE A FUNCTION TO GET ALL FRIEND SHARED PAGES FOR A USER
-- ============================================================================

CREATE OR REPLACE FUNCTION get_friend_shared_pages_for_user(p_user_id UUID)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH friend_pages AS (
    SELECT DISTINCT
      p.id,
      p.title,
      p.user_id as owner_id,
      p.visibility,
      p.created_at,
      u.full_name as owner_name,
      u.email as owner_email
    FROM pages p
    INNER JOIN friends f ON (
      (f.user_id = p_user_id AND f.friend_id = p.user_id) OR
      (f.friend_id = p_user_id AND f.user_id = p.user_id)
    )
    INNER JOIN users u ON u.id = p.user_id
    WHERE p.visibility = 'friends'
    AND p.user_id != p_user_id
    ORDER BY p.created_at DESC
  )
  SELECT json_build_object(
    'user_id', p_user_id,
    'total_friend_shared_pages', (SELECT COUNT(*) FROM friend_pages),
    'pages', (SELECT json_agg(row_to_json(friend_pages)) FROM friend_pages)
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_friend_shared_pages_for_user(UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION AND TESTING QUERIES
-- ============================================================================

-- Create a comprehensive test function that mimics the actual query
CREATE OR REPLACE FUNCTION test_page_select_with_rls(p_user_id UUID)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  -- This function tests what pages a user can see with current RLS policies
  WITH accessible_pages AS (
    SELECT 
      p.id,
      p.title,
      p.user_id as owner_id,
      p.visibility,
      p.created_at,
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
      END as access_type
    FROM pages p
    WHERE (
      -- Owner access
      p.user_id = p_user_id
    ) OR (
      -- Public access
      p.visibility = 'public'
    ) OR (
      -- Friend access
      p.visibility = 'friends' AND
      p.user_id != p_user_id AND
      EXISTS(
        SELECT 1 FROM friends f
        WHERE (
          (f.user_id = p_user_id AND f.friend_id = p.user_id) OR
          (f.friend_id = p_user_id AND f.user_id = p.user_id)
        )
      )
    )
  )
  SELECT json_build_object(
    'user_id', p_user_id,
    'total_accessible_pages', (SELECT COUNT(*) FROM accessible_pages),
    'own_pages', (SELECT COUNT(*) FROM accessible_pages WHERE access_type = 'owner'),
    'friend_pages', (SELECT COUNT(*) FROM accessible_pages WHERE access_type = 'friend'),
    'public_pages', (SELECT COUNT(*) FROM accessible_pages WHERE access_type = 'public'),
    'pages', (SELECT json_agg(row_to_json(accessible_pages)) FROM accessible_pages)
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_page_select_with_rls(UUID) TO authenticated;