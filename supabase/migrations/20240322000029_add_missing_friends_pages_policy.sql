-- Add missing RLS policy for friends to access pages with 'friends' visibility
-- This policy allows users to view pages owned by their friends when visibility = 'friends'

-- First, ensure RLS is enabled on pages table
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Add the missing policy for friends to view 'friends' pages
CREATE POLICY "friends_can_view_friends_pages" ON pages
  FOR SELECT
  USING (
    visibility = 'friends' AND (
      -- Check if current user is friends with the page owner
      EXISTS (
        SELECT 1 FROM friends
        WHERE (
          (user_id = auth.uid() AND friend_id = pages.user_id) OR
          (user_id = pages.user_id AND friend_id = auth.uid())
        )
      )
    )
  );

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'pages' AND policyname = 'friends_can_view_friends_pages';
