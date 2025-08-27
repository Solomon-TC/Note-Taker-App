-- Comprehensive fix for friends shared pages RLS policies
-- This migration addresses all known issues with friends viewing shared pages

-- Enable RLS on pages table if not already enabled
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
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

-- Policy 1: Users can always view their own pages (regardless of visibility)
CREATE POLICY "Users can view own pages"
  ON pages FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy 2: Friends can view pages marked as 'friends' visibility
-- Fixed with proper UUID to text casting and comprehensive friendship check
CREATE POLICY "Friends can view shared pages"
  ON pages FOR SELECT
  USING (
    visibility = 'friends' 
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM friends f
      WHERE (
        (f.user_id = auth.uid()::text AND f.friend_id = pages.user_id::text)
        OR 
        (f.friend_id = auth.uid()::text AND f.user_id = pages.user_id::text)
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

-- Add helpful comments for documentation
COMMENT ON TABLE pages IS 'Pages table with RLS policies supporting private and friends visibility modes. Friends can view pages marked as friends visibility.';
COMMENT ON POLICY "Friends can view shared pages" ON pages IS 'Allows friends to view pages with friends visibility by checking the friends table relationship in both directions with proper UUID casting.';

-- Create a helper function to debug friendship relationships
CREATE OR REPLACE FUNCTION debug_friendship_access(
  p_current_user_id text,
  p_page_owner_id text
)
RETURNS TABLE(
  friendship_exists boolean,
  friendship_direction text,
  current_user_id text,
  page_owner_id text
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
    p_page_owner_id as page_owner_id;
END;
$$;

-- Grant execute permission on the debug function
GRANT EXECUTE ON FUNCTION debug_friendship_access(text, text) TO authenticated;
