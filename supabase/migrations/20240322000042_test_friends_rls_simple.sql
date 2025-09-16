-- Simple test to verify friends RLS policies are working
-- This migration creates a simple test function to verify RLS policies

-- ============================================================================
-- CREATE SIMPLE TEST FUNCTION FOR FRIENDS PAGE ACCESS
-- ============================================================================

CREATE OR REPLACE FUNCTION test_friends_page_access_simple(
  p_current_user_id UUID,
  p_friend_user_id UUID
)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH friendship_check AS (
    SELECT EXISTS(
      SELECT 1 FROM friends 
      WHERE (
        (user_id = p_current_user_id AND friend_id = p_friend_user_id) OR
        (friend_id = p_current_user_id AND user_id = p_friend_user_id)
      )
    ) as friendship_exists
  ),
  friend_pages AS (
    SELECT 
      COUNT(*) as total_pages,
      COUNT(*) FILTER (WHERE visibility = 'friends') as friends_pages,
      json_agg(
        json_build_object(
          'id', id,
          'title', title,
          'visibility', visibility
        )
      ) FILTER (WHERE visibility = 'friends') as friends_pages_data
    FROM pages 
    WHERE user_id = p_friend_user_id
  ),
  rls_test AS (
    -- This simulates what the RLS policy should allow
    SELECT 
      COUNT(*) as accessible_pages,
      json_agg(
        json_build_object(
          'id', id,
          'title', title,
          'visibility', visibility
        )
      ) as accessible_pages_data
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
  SELECT json_build_object(
    'current_user_id', p_current_user_id,
    'friend_user_id', p_friend_user_id,
    'friendship_exists', (SELECT friendship_exists FROM friendship_check),
    'friend_total_pages', (SELECT total_pages FROM friend_pages),
    'friend_friends_pages', (SELECT friends_pages FROM friend_pages),
    'friends_pages_data', (SELECT friends_pages_data FROM friend_pages),
    'rls_accessible_pages', (SELECT accessible_pages FROM rls_test),
    'rls_accessible_data', (SELECT accessible_pages_data FROM rls_test),
    'should_work', (
      SELECT friendship_exists AND friends_pages > 0 
      FROM friendship_check, friend_pages
    )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_friends_page_access_simple(UUID, UUID) TO authenticated;

-- ============================================================================
-- CREATE FUNCTION TO MANUALLY TEST RLS BYPASS
-- ============================================================================

CREATE OR REPLACE FUNCTION test_rls_bypass_friends_pages(
  p_current_user_id UUID,
  p_friend_user_id UUID
)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  -- This function bypasses RLS to show what pages exist vs what RLS allows
  WITH all_friend_pages AS (
    SELECT 
      id,
      title,
      visibility,
      user_id,
      created_at
    FROM pages 
    WHERE user_id = p_friend_user_id
    ORDER BY created_at DESC
  ),
  friendship_status AS (
    SELECT 
      EXISTS(
        SELECT 1 FROM friends 
        WHERE (
          (user_id = p_current_user_id AND friend_id = p_friend_user_id) OR
          (friend_id = p_current_user_id AND user_id = p_friend_user_id)
        )
      ) as are_friends,
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
      ) as friendship_records
  )
  SELECT json_build_object(
    'test_info', json_build_object(
      'current_user_id', p_current_user_id,
      'friend_user_id', p_friend_user_id,
      'test_timestamp', now()
    ),
    'friendship_status', (SELECT row_to_json(friendship_status) FROM friendship_status),
    'all_friend_pages', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'title', title,
          'visibility', visibility,
          'user_id', user_id,
          'created_at', created_at
        )
      )
      FROM all_friend_pages
    ),
    'friends_visibility_pages', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'title', title,
          'visibility', visibility,
          'user_id', user_id,
          'created_at', created_at
        )
      )
      FROM all_friend_pages
      WHERE visibility = 'friends'
    ),
    'summary', json_build_object(
      'total_pages', (SELECT COUNT(*) FROM all_friend_pages),
      'friends_pages', (SELECT COUNT(*) FROM all_friend_pages WHERE visibility = 'friends'),
      'private_pages', (SELECT COUNT(*) FROM all_friend_pages WHERE visibility = 'private'),
      'public_pages', (SELECT COUNT(*) FROM all_friend_pages WHERE visibility = 'public')
    )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_rls_bypass_friends_pages(UUID, UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES FOR MANUAL TESTING
-- ============================================================================

/*
-- Test 1: Simple friends page access test
SELECT test_friends_page_access_simple('current-user-id', 'friend-user-id');

-- Test 2: RLS bypass test to see all data
SELECT test_rls_bypass_friends_pages('current-user-id', 'friend-user-id');

-- Test 3: Direct friendship check
SELECT * FROM friends WHERE 
  (user_id = 'current-user-id' AND friend_id = 'friend-user-id') OR
  (friend_id = 'current-user-id' AND user_id = 'friend-user-id');

-- Test 4: Direct pages check (bypasses RLS)
SELECT id, title, user_id, visibility, created_at FROM pages 
WHERE user_id = 'friend-user-id' AND visibility = 'friends'
ORDER BY created_at DESC;

-- Test 5: Test the actual RLS query (this is what the app runs)
-- Run this as the current user to see if RLS allows access
SELECT id, title, visibility, user_id FROM pages 
WHERE user_id = 'friend-user-id' AND visibility = 'friends';
*/