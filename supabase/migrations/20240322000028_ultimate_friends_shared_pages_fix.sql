-- Ultimate comprehensive fix for friends shared pages functionality
-- This migration completely rebuilds the RLS system with proper debugging and type handling

-- First, let's examine and fix the table structures
-- Check if we need to update column types for consistency

-- Enable RLS on all relevant tables
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on pages table to start completely fresh
DROP POLICY IF EXISTS "Users can view own pages" ON pages;
DROP POLICY IF EXISTS "Users can insert own pages" ON pages;
DROP POLICY IF EXISTS "Users can update own pages" ON pages;
DROP POLICY IF EXISTS "Users can delete own pages" ON pages;
DROP POLICY IF EXISTS "Friends can view shared pages" ON pages;
DROP POLICY IF EXISTS "Enable read access for own pages" ON pages;
DROP POLICY IF EXISTS "Enable insert access for own pages" ON pages;
DROP POLICY IF EXISTS "Enable update access for own pages" ON pages;
DROP POLICY IF EXISTS "Enable delete access for own pages" ON pages;
DROP POLICY IF EXISTS "Enable friends to view shared pages" ON pages;
DROP POLICY IF EXISTS "Allow users to view own pages" ON pages;
DROP POLICY IF EXISTS "Allow friends to view shared pages" ON pages;

-- Drop existing functions to recreate them properly
DROP FUNCTION IF EXISTS debug_friendship_access(text, text);
DROP FUNCTION IF EXISTS test_page_access(text, text);
DROP FUNCTION IF EXISTS get_user_friends_with_shared_pages(text);

-- Create a comprehensive debug function first
CREATE OR REPLACE FUNCTION debug_friendship_access(
  p_current_user_id text,
  p_page_owner_id text
)
RETURNS TABLE(
  friendship_exists boolean,
  friendship_direction text,
  current_user_id text,
  page_owner_id text,
  auth_user_id text,
  friends_count bigint,
  friendship_details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_friendship_record friends%ROWTYPE;
BEGIN
  -- Get friendship details
  SELECT * INTO v_friendship_record 
  FROM friends f
  WHERE (
    (f.user_id = p_current_user_id AND f.friend_id = p_page_owner_id)
    OR 
    (f.friend_id = p_current_user_id AND f.user_id = p_page_owner_id)
  )
  LIMIT 1;
  
  RETURN QUERY
  SELECT 
    EXISTS(
      SELECT 1 FROM friends f
      WHERE (
        (f.user_id = p_current_user_id AND f.friend_id = p_page_owner_id)
        OR 
        (f.friend_id = p_current_user_id AND f.user_id = p_page_owner_id)
      )
    ) as friendship_exists,
    CASE 
      WHEN EXISTS(SELECT 1 FROM friends f WHERE f.user_id = p_current_user_id AND f.friend_id = p_page_owner_id) THEN 'user_to_friend'
      WHEN EXISTS(SELECT 1 FROM friends f WHERE f.friend_id = p_current_user_id AND f.user_id = p_page_owner_id) THEN 'friend_to_user'
      ELSE 'none'
    END as friendship_direction,
    p_current_user_id as current_user_id,
    p_page_owner_id as page_owner_id,
    COALESCE(auth.uid()::text, 'no_auth') as auth_user_id,
    (SELECT COUNT(*) FROM friends f WHERE f.user_id = p_current_user_id OR f.friend_id = p_current_user_id) as friends_count,
    CASE 
      WHEN v_friendship_record.id IS NOT NULL THEN
        jsonb_build_object(
          'id', v_friendship_record.id,
          'user_id', v_friendship_record.user_id,
          'friend_id', v_friendship_record.friend_id,
          'created_at', v_friendship_record.created_at
        )
      ELSE NULL
    END as friendship_details;
END;
$$;

-- Create a function to test page access with detailed debugging
CREATE OR REPLACE FUNCTION test_page_access(
  p_page_id text,
  p_user_id text DEFAULT NULL
)
RETURNS TABLE(
  page_exists boolean,
  page_id text,
  page_title text,
  page_visibility text,
  page_owner text,
  test_user_id text,
  can_access boolean,
  access_reason text,
  friendship_check jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_page_record pages%ROWTYPE;
  v_test_user_id text;
  v_friendship_exists boolean;
BEGIN
  -- Use provided user_id or current auth user
  v_test_user_id := COALESCE(p_user_id, auth.uid()::text);
  
  -- Get page details
  SELECT * INTO v_page_record FROM pages WHERE id = p_page_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false, p_page_id, NULL::text, NULL::text, NULL::text, v_test_user_id, 
      false, 'Page not found', NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check friendship if needed
  IF v_page_record.visibility = 'friends' AND v_page_record.user_id != v_test_user_id THEN
    SELECT EXISTS(
      SELECT 1 FROM friends f
      WHERE (
        (f.user_id = v_test_user_id AND f.friend_id = v_page_record.user_id)
        OR 
        (f.friend_id = v_test_user_id AND f.user_id = v_page_record.user_id)
      )
    ) INTO v_friendship_exists;
  ELSE
    v_friendship_exists := false;
  END IF;
  
  -- Determine access
  IF v_page_record.user_id = v_test_user_id THEN
    RETURN QUERY SELECT 
      true, v_page_record.id, v_page_record.title, v_page_record.visibility, 
      v_page_record.user_id, v_test_user_id, true, 'Owner access',
      jsonb_build_object('is_owner', true, 'friendship_required', false);
  ELSIF v_page_record.visibility = 'private' THEN
    RETURN QUERY SELECT 
      true, v_page_record.id, v_page_record.title, v_page_record.visibility, 
      v_page_record.user_id, v_test_user_id, false, 'Private page - access denied',
      jsonb_build_object('is_owner', false, 'friendship_required', false, 'is_private', true);
  ELSIF v_page_record.visibility = 'friends' AND v_friendship_exists THEN
    RETURN QUERY SELECT 
      true, v_page_record.id, v_page_record.title, v_page_record.visibility, 
      v_page_record.user_id, v_test_user_id, true, 'Friend access granted',
      jsonb_build_object('is_owner', false, 'friendship_required', true, 'friendship_exists', true);
  ELSIF v_page_record.visibility = 'friends' AND NOT v_friendship_exists THEN
    RETURN QUERY SELECT 
      true, v_page_record.id, v_page_record.title, v_page_record.visibility, 
      v_page_record.user_id, v_test_user_id, false, 'Friends page - no friendship found',
      jsonb_build_object('is_owner', false, 'friendship_required', true, 'friendship_exists', false);
  ELSE
    RETURN QUERY SELECT 
      true, v_page_record.id, v_page_record.title, v_page_record.visibility, 
      v_page_record.user_id, v_test_user_id, false, 'Unknown access condition',
      jsonb_build_object('is_owner', false, 'visibility', v_page_record.visibility);
  END IF;
END;
$$;

-- Create a function to get comprehensive friendship and page data
CREATE OR REPLACE FUNCTION get_friendship_and_pages_debug(
  p_current_user_id text,
  p_friend_id text
)
RETURNS TABLE(
  friendship_exists boolean,
  friendship_data jsonb,
  friend_pages_total integer,
  friend_pages_private integer,
  friend_pages_friends integer,
  accessible_pages jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_friendship_exists boolean;
  v_friendship_data jsonb;
  v_accessible_pages jsonb;
BEGIN
  -- Check friendship
  SELECT EXISTS(
    SELECT 1 FROM friends f
    WHERE (
      (f.user_id = p_current_user_id AND f.friend_id = p_friend_id)
      OR 
      (f.friend_id = p_current_user_id AND f.user_id = p_friend_id)
    )
  ) INTO v_friendship_exists;
  
  -- Get friendship details
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'user_id', f.user_id,
      'friend_id', f.friend_id,
      'created_at', f.created_at
    )
  ) INTO v_friendship_data
  FROM friends f
  WHERE (
    (f.user_id = p_current_user_id AND f.friend_id = p_friend_id)
    OR 
    (f.friend_id = p_current_user_id AND f.user_id = p_friend_id)
  );
  
  -- Get accessible pages if friendship exists
  IF v_friendship_exists THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'visibility', p.visibility,
        'created_at', p.created_at,
        'updated_at', p.updated_at
      )
    ) INTO v_accessible_pages
    FROM pages p
    WHERE p.user_id = p_friend_id 
      AND p.visibility = 'friends';
  ELSE
    v_accessible_pages := '[]'::jsonb;
  END IF;
  
  RETURN QUERY
  SELECT 
    v_friendship_exists,
    COALESCE(v_friendship_data, '[]'::jsonb),
    (SELECT COUNT(*)::integer FROM pages WHERE user_id = p_friend_id),
    (SELECT COUNT(*)::integer FROM pages WHERE user_id = p_friend_id AND visibility = 'private'),
    (SELECT COUNT(*)::integer FROM pages WHERE user_id = p_friend_id AND visibility = 'friends'),
    COALESCE(v_accessible_pages, '[]'::jsonb);
END;
$$;

-- Now create the RLS policies with proper type handling and comprehensive logic

-- Policy 1: Users can always view their own pages (regardless of visibility)
CREATE POLICY "Users can view own pages"
  ON pages FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND auth.uid()::text = user_id
  );

-- Policy 2: Friends can view pages marked as 'friends' visibility
-- This is the critical policy with enhanced debugging and proper type handling
CREATE POLICY "Friends can view shared pages"
  ON pages FOR SELECT
  USING (
    visibility = 'friends' 
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text != user_id  -- Don't use this policy for own pages
    AND EXISTS (
      SELECT 1 FROM friends f
      WHERE (
        -- Check both directions of friendship with explicit type casting
        (f.user_id = auth.uid()::text AND f.friend_id = pages.user_id)
        OR 
        (f.friend_id = auth.uid()::text AND f.user_id = pages.user_id)
      )
    )
  );

-- Policy 3: Users can insert their own pages
CREATE POLICY "Users can insert own pages"
  ON pages FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid()::text = user_id
  );

-- Policy 4: Users can update their own pages
CREATE POLICY "Users can update own pages"
  ON pages FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND auth.uid()::text = user_id
  )
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid()::text = user_id
  );

-- Policy 5: Users can delete their own pages
CREATE POLICY "Users can delete own pages"
  ON pages FOR DELETE
  USING (
    auth.uid() IS NOT NULL 
    AND auth.uid()::text = user_id
  );

-- Ensure friends table has proper RLS policies
DROP POLICY IF EXISTS "Users can view own friendships" ON friends;
DROP POLICY IF EXISTS "Users can insert own friendships" ON friends;
DROP POLICY IF EXISTS "Users can delete own friendships" ON friends;

CREATE POLICY "Users can view own friendships"
  ON friends FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND (
      auth.uid()::text = user_id 
      OR auth.uid()::text = friend_id
    )
  );

CREATE POLICY "Users can insert own friendships"
  ON friends FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
      auth.uid()::text = user_id 
      OR auth.uid()::text = friend_id
    )
  );

CREATE POLICY "Users can delete own friendships"
  ON friends FOR DELETE
  USING (
    auth.uid() IS NOT NULL 
    AND (
      auth.uid()::text = user_id 
      OR auth.uid()::text = friend_id
    )
  );

-- Ensure users table has proper RLS policies for friends functionality
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view friends profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND auth.uid()::text = id
  );

CREATE POLICY "Users can view friends profiles"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM friends f
      WHERE (
        (f.user_id = auth.uid()::text AND f.friend_id = users.id)
        OR 
        (f.friend_id = auth.uid()::text AND f.user_id = users.id)
      )
    )
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND auth.uid()::text = id
  )
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid()::text = id
  );

-- Ensure pages table is in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'pages'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pages;
  END IF;
END $$;

-- Grant execute permissions on all debug functions
GRANT EXECUTE ON FUNCTION debug_friendship_access(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION test_page_access(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friendship_and_pages_debug(text, text) TO authenticated;

-- Add comprehensive comments for documentation
COMMENT ON TABLE pages IS 'Pages table with comprehensive RLS policies supporting private and friends visibility modes. Friends can view pages marked as friends visibility through proper friendship verification.';
COMMENT ON POLICY "Friends can view shared pages" ON pages IS 'Allows friends to view pages with friends visibility by checking the friends table relationship in both directions with proper UUID to text casting and authentication verification.';
COMMENT ON FUNCTION debug_friendship_access(text, text) IS 'Comprehensive debug function to test friendship relationships and access permissions with detailed output.';
COMMENT ON FUNCTION test_page_access(text, text) IS 'Detailed test function to verify page access permissions for a given user with comprehensive debugging information.';
COMMENT ON FUNCTION get_friendship_and_pages_debug(text, text) IS 'Complete debugging function that provides friendship status and accessible pages information.';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pages_user_id_visibility ON pages(user_id, visibility);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_pages_visibility ON pages(visibility) WHERE visibility = 'friends';
