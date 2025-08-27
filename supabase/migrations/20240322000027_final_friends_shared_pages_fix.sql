-- Final comprehensive fix for friends shared pages functionality
-- This migration addresses all identified issues with type casting and RLS policies

-- Enable RLS on pages table if not already enabled
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start completely fresh
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

-- First, let's check the actual data types in our tables
-- The issue is likely that user_id in pages is text but auth.uid() returns uuid

-- Policy 1: Users can always view their own pages (regardless of visibility)
-- Fixed with proper type casting
CREATE POLICY "Users can view own pages"
  ON pages FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy 2: Friends can view pages marked as 'friends' visibility
-- This is the critical policy - fixed with proper type handling
CREATE POLICY "Friends can view shared pages"
  ON pages FOR SELECT
  USING (
    visibility = 'friends' 
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM friends f
      WHERE (
        -- Check both directions of friendship
        (f.user_id = auth.uid()::text AND f.friend_id = pages.user_id)
        OR 
        (f.friend_id = auth.uid()::text AND f.user_id = pages.user_id)
      )
    )
  );

-- Policy 3: Users can insert their own pages
CREATE POLICY "Users can insert own pages"
  ON pages FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy 4: Users can update their own pages
CREATE POLICY "Users can update own pages"
  ON pages FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Policy 5: Users can delete their own pages
CREATE POLICY "Users can delete own pages"
  ON pages FOR DELETE
  USING (auth.uid()::text = user_id);

-- Ensure pages table is in realtime publication (only if not already added)
DO $$
BEGIN
  -- Check if pages table is already in supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'pages'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pages;
  END IF;
END $$;

-- Create an improved debug function to test friendship access
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
  friends_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    auth.uid()::text as auth_user_id,
    (SELECT COUNT(*) FROM friends f WHERE f.user_id = p_current_user_id OR f.friend_id = p_current_user_id) as friends_count;
END;
$$;

-- Create a function to test page visibility access
CREATE OR REPLACE FUNCTION test_page_access(
  p_page_id text,
  p_user_id text DEFAULT NULL
)
RETURNS TABLE(
  page_exists boolean,
  page_visibility text,
  page_owner text,
  can_access boolean,
  access_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_page_record pages%ROWTYPE;
  v_test_user_id text;
BEGIN
  -- Use provided user_id or current auth user
  v_test_user_id := COALESCE(p_user_id, auth.uid()::text);
  
  -- Get page details
  SELECT * INTO v_page_record FROM pages WHERE id = p_page_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false, 'Page not found';
    RETURN;
  END IF;
  
  -- Check access
  IF v_page_record.user_id = v_test_user_id THEN
    RETURN QUERY SELECT true, v_page_record.visibility, v_page_record.user_id, true, 'Owner access';
  ELSIF v_page_record.visibility = 'friends' AND EXISTS(
    SELECT 1 FROM friends f
    WHERE (
      (f.user_id = v_test_user_id AND f.friend_id = v_page_record.user_id)
      OR 
      (f.friend_id = v_test_user_id AND f.user_id = v_page_record.user_id)
    )
  ) THEN
    RETURN QUERY SELECT true, v_page_record.visibility, v_page_record.user_id, true, 'Friend access';
  ELSE
    RETURN QUERY SELECT true, v_page_record.visibility, v_page_record.user_id, false, 'Access denied';
  END IF;
END;
$$;

-- Grant execute permissions on debug functions
GRANT EXECUTE ON FUNCTION debug_friendship_access(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION test_page_access(text, text) TO authenticated;

-- Add helpful comments for documentation
COMMENT ON TABLE pages IS 'Pages table with RLS policies supporting private and friends visibility modes. Friends can view pages marked as friends visibility.';
COMMENT ON POLICY "Friends can view shared pages" ON pages IS 'Allows friends to view pages with friends visibility by checking the friends table relationship in both directions with proper type casting.';
COMMENT ON FUNCTION debug_friendship_access(text, text) IS 'Debug function to test friendship relationships and access permissions.';
COMMENT ON FUNCTION test_page_access(text, text) IS 'Test function to verify page access permissions for a given user.';
