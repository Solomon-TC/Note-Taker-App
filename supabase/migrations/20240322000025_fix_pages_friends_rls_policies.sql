-- Fix RLS policies for pages table to support friends visibility
-- This migration resolves the realtime publication conflict and ensures proper friend access

-- Enable RLS on pages table if not already enabled
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
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

-- Policy 1: Users can always view their own pages (regardless of visibility)
CREATE POLICY "Users can view own pages"
  ON pages FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Friends can view pages marked as 'friends' visibility
-- This policy checks if the current user is friends with the page owner
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
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can update their own pages
CREATE POLICY "Users can update own pages"
  ON pages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 5: Users can delete their own pages
CREATE POLICY "Users can delete own pages"
  ON pages FOR DELETE
  USING (auth.uid() = user_id);

-- Ensure pages table is in realtime publication (only if not already added)
-- Check if pages is already in the publication before adding
DO $$
BEGIN
  -- Check if pages table is already in supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'pages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pages;
  END IF;
END $$;

-- Add helpful comments for documentation
COMMENT ON TABLE pages IS 'Pages table with RLS policies supporting private and friends visibility modes. Friends can view pages marked as friends visibility.';
COMMENT ON POLICY "Friends can view shared pages" ON pages IS 'Allows friends to view pages with friends visibility by checking the friends table relationship in both directions.';