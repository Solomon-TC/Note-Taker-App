-- Add RLS policies for pages table to support friends visibility
-- This migration enables friends to view each other's pages marked with 'friends' visibility

-- Enable RLS on pages table if not already enabled
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own pages" ON pages;
DROP POLICY IF EXISTS "Users can insert own pages" ON pages;
DROP POLICY IF EXISTS "Users can update own pages" ON pages;
DROP POLICY IF EXISTS "Users can delete own pages" ON pages;
DROP POLICY IF EXISTS "Friends can view shared pages" ON pages;

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
    AND EXISTS (
      SELECT 1 FROM friends f
      WHERE (
        (f.user_id = auth.uid() AND f.friend_id = pages.user_id)
        OR 
        (f.friend_id = auth.uid() AND f.user_id = pages.user_id)
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

-- Note: pages table is already added to supabase_realtime publication

-- Add comment for documentation
COMMENT ON TABLE pages IS 'Pages table with RLS policies supporting private and friends visibility modes';
