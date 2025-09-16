-- Fix RLS Policies for Friend Page Visibility and Page Saving (Targeted Fix)
-- This migration addresses issues with friend page access and page saving functionality

-- ============================================================================
-- CLEAN UP AND FIX PAGES TABLE RLS POLICIES
-- ============================================================================

-- First, disable RLS temporarily to clean up
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

-- Create new, working policies

-- Policy: Users can SELECT their own pages
CREATE POLICY "Users can view their own pages"
ON pages FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can INSERT their own pages
CREATE POLICY "Users can create their own pages"
ON pages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can UPDATE their own pages
CREATE POLICY "Users can update their own pages"
ON pages FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can DELETE their own pages
CREATE POLICY "Users can delete their own pages"
ON pages FOR DELETE
USING (auth.uid() = user_id);

-- Policy: Friends can view pages with 'friends' visibility (FIXED)
CREATE POLICY "Friends can view shared pages"
ON pages FOR SELECT
USING (
  visibility = 'friends' AND
  EXISTS (
    SELECT 1 FROM friends 
    WHERE (
      (user_id = auth.uid() AND friend_id = pages.user_id) OR
      (friend_id = auth.uid() AND user_id = pages.user_id)
    )
  )
);

-- Policy: Anyone can view public pages
CREATE POLICY "Anyone can view public pages"
ON pages FOR SELECT
USING (visibility = 'public' AND auth.role() = 'authenticated');

-- ============================================================================
-- CLEAN UP AND FIX FRIENDS TABLE RLS POLICIES
-- ============================================================================

-- Temporarily disable RLS on friends table
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

-- Create working friends policies
CREATE POLICY "Users can view their friendships"
ON friends FOR SELECT
USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can create friendships"
ON friends FOR INSERT
WITH CHECK (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can update friendships"
ON friends FOR UPDATE
USING (user_id = auth.uid() OR friend_id = auth.uid())
WITH CHECK (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can delete friendships"
ON friends FOR DELETE
USING (user_id = auth.uid() OR friend_id = auth.uid());

-- ============================================================================
-- CREATE DEBUG FUNCTIONS FOR TROUBLESHOOTING
-- ============================================================================

-- Function to debug friendship access
CREATE OR REPLACE FUNCTION debug_friendship_access(
  p_current_user_id UUID,
  p_page_owner_id UUID
)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'current_user_id', p_current_user_id,
    'page_owner_id', p_page_owner_id,
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
    'auth_uid', auth.uid(),
    'auth_role', auth.role()
  );
$$;

-- Function to test page access
CREATE OR REPLACE FUNCTION test_page_access(
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
      user_id as page_owner_id,
      visibility,
      CASE 
        WHEN user_id = p_user_id THEN 'owner'
        WHEN visibility = 'public' THEN 'public'
        WHEN visibility = 'friends' AND EXISTS(
          SELECT 1 FROM friends 
          WHERE (
            (user_id = p_user_id AND friend_id = pages.user_id) OR
            (friend_id = p_user_id AND user_id = pages.user_id)
          )
        ) THEN 'friend'
        ELSE 'no_access'
      END as access_reason
    FROM pages 
    WHERE id = p_page_id
  )
  SELECT json_build_object(
    'page_id', p_page_id,
    'user_id', p_user_id,
    'page_exists', EXISTS(SELECT 1 FROM page_info),
    'page_info', (SELECT row_to_json(page_info) FROM page_info),
    'can_access', (SELECT access_reason != 'no_access' FROM page_info),
    'access_reason', (SELECT access_reason FROM page_info),
    'friendship_check', (
      SELECT json_build_object(
        'friendship_exists', EXISTS(
          SELECT 1 FROM friends 
          WHERE (
            (user_id = p_user_id AND friend_id = (SELECT page_owner_id FROM page_info)) OR
            (friend_id = p_user_id AND user_id = (SELECT page_owner_id FROM page_info))
          )
        ),
        'friendship_details', (
          SELECT json_agg(
            json_build_object(
              'user_id', user_id,
              'friend_id', friend_id,
              'created_at', created_at
            )
          )
          FROM friends 
          WHERE (
            (user_id = p_user_id AND friend_id = (SELECT page_owner_id FROM page_info)) OR
            (friend_id = p_user_id AND user_id = (SELECT page_owner_id FROM page_info))
          )
        )
      )
    )
  );
$$;

-- Function to get comprehensive friendship and pages debug info
CREATE OR REPLACE FUNCTION get_friendship_and_pages_debug(
  p_current_user_id UUID,
  p_friend_id UUID
)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'current_user_id', p_current_user_id,
    'friend_id', p_friend_id,
    'friendship_exists', EXISTS(
      SELECT 1 FROM friends 
      WHERE (
        (user_id = p_current_user_id AND friend_id = p_friend_id) OR
        (friend_id = p_current_user_id AND user_id = p_friend_id)
      )
    ),
    'friendship_data', (
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
        (user_id = p_current_user_id AND friend_id = p_friend_id) OR
        (friend_id = p_current_user_id AND user_id = p_friend_id)
      )
    ),
    'friend_pages_total', (
      SELECT COUNT(*) FROM pages WHERE user_id = p_friend_id
    ),
    'friend_pages_private', (
      SELECT COUNT(*) FROM pages WHERE user_id = p_friend_id AND visibility = 'private'
    ),
    'friend_pages_friends', (
      SELECT COUNT(*) FROM pages WHERE user_id = p_friend_id AND visibility = 'friends'
    ),
    'accessible_pages', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'title', title,
          'visibility', visibility,
          'created_at', created_at
        )
      )
      FROM pages 
      WHERE user_id = p_friend_id 
      AND visibility = 'friends'
      AND EXISTS(
        SELECT 1 FROM friends 
        WHERE (
          (user_id = p_current_user_id AND friend_id = p_friend_id) OR
          (friend_id = p_current_user_id AND user_id = p_friend_id)
        )
      )
    )
  );
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION debug_friendship_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION test_page_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friendship_and_pages_debug(UUID, UUID) TO authenticated;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

/*
-- TO ROLLBACK THIS MIGRATION:

-- Drop the new policies
DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
DROP POLICY IF EXISTS "Users can create their own pages" ON pages;
DROP POLICY IF EXISTS "Users can update their own pages" ON pages;
DROP POLICY IF EXISTS "Users can delete their own pages" ON pages;
DROP POLICY IF EXISTS "Friends can view shared pages" ON pages;
DROP POLICY IF EXISTS "Anyone can view public pages" ON pages;

DROP POLICY IF EXISTS "Users can view their friendships" ON friends;
DROP POLICY IF EXISTS "Users can create friendships" ON friends;
DROP POLICY IF EXISTS "Users can update friendships" ON friends;
DROP POLICY IF EXISTS "Users can delete friendships" ON friends;

-- Drop debug functions
DROP FUNCTION IF EXISTS debug_friendship_access(UUID, UUID);
DROP FUNCTION IF EXISTS test_page_access(UUID, UUID);
DROP FUNCTION IF EXISTS get_friendship_and_pages_debug(UUID, UUID);

-- Restore original policies (if needed)
-- You would need to run the previous migration again
*/