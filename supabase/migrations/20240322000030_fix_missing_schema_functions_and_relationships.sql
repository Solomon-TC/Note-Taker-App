-- Fix missing schema functions and relationships for shared pages functionality

-- First, ensure the foreign key relationship exists between pages and users
ALTER TABLE pages 
DROP CONSTRAINT IF EXISTS pages_user_id_fkey;

ALTER TABLE pages 
ADD CONSTRAINT pages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_visibility ON pages(visibility);
CREATE INDEX IF NOT EXISTS idx_pages_user_visibility ON pages(user_id, visibility);

-- Create the missing test_page_access function
CREATE OR REPLACE FUNCTION test_page_access(
  p_page_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  page_record RECORD;
  friendship_exists BOOLEAN := FALSE;
  can_access BOOLEAN := FALSE;
  access_reason TEXT := 'No access';
  result JSON;
BEGIN
  -- Get page details
  SELECT * INTO page_record
  FROM pages
  WHERE id = p_page_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'can_access', false,
      'access_reason', 'Page not found',
      'page_exists', false
    );
  END IF;
  
  -- Check if user owns the page
  IF page_record.user_id = p_user_id THEN
    can_access := TRUE;
    access_reason := 'Page owner';
  -- Check if page is set to friends visibility
  ELSIF page_record.visibility = 'friends' THEN
    -- Check if friendship exists
    SELECT EXISTS(
      SELECT 1 FROM friends 
      WHERE (user_id = p_user_id AND friend_id = page_record.user_id)
         OR (user_id = page_record.user_id AND friend_id = p_user_id)
    ) INTO friendship_exists;
    
    IF friendship_exists THEN
      can_access := TRUE;
      access_reason := 'Friend access to friends page';
    ELSE
      access_reason := 'Not friends with page owner';
    END IF;
  ELSE
    access_reason := 'Page is private';
  END IF;
  
  RETURN json_build_object(
    'can_access', can_access,
    'access_reason', access_reason,
    'page_exists', true,
    'page_visibility', page_record.visibility,
    'page_owner', page_record.user_id,
    'requesting_user', p_user_id,
    'friendship_check', friendship_exists
  );
END;
$$;

-- Create the missing get_friendship_and_pages_debug function
CREATE OR REPLACE FUNCTION get_friendship_and_pages_debug(
  p_current_user_id UUID,
  p_friend_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  friendship_data RECORD;
  friendship_exists BOOLEAN := FALSE;
  friend_pages_total INTEGER := 0;
  friend_pages_private INTEGER := 0;
  friend_pages_friends INTEGER := 0;
  accessible_pages JSON;
  result JSON;
BEGIN
  -- Check friendship
  SELECT * INTO friendship_data
  FROM friends 
  WHERE (user_id = p_current_user_id AND friend_id = p_friend_id)
     OR (user_id = p_friend_id AND friend_id = p_current_user_id)
  LIMIT 1;
  
  friendship_exists := FOUND;
  
  -- Count friend's pages by visibility
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE visibility = 'private') as private_count,
    COUNT(*) FILTER (WHERE visibility = 'friends') as friends_count
  INTO friend_pages_total, friend_pages_private, friend_pages_friends
  FROM pages
  WHERE user_id = p_friend_id;
  
  -- Get accessible pages for the current user
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'title', p.title,
      'visibility', p.visibility,
      'created_at', p.created_at
    )
  ) INTO accessible_pages
  FROM pages p
  WHERE p.user_id = p_friend_id 
    AND p.visibility = 'friends'
    AND friendship_exists = TRUE;
  
  RETURN json_build_object(
    'friendship_exists', friendship_exists,
    'friendship_data', CASE 
      WHEN friendship_exists THEN 
        json_build_object(
          'id', friendship_data.id,
          'user_id', friendship_data.user_id,
          'friend_id', friendship_data.friend_id,
          'created_at', friendship_data.created_at
        )
      ELSE null
    END,
    'friend_pages_total', friend_pages_total,
    'friend_pages_private', friend_pages_private,
    'friend_pages_friends', friend_pages_friends,
    'accessible_pages', COALESCE(accessible_pages, '[]'::json),
    'debug_info', json_build_object(
      'current_user_id', p_current_user_id,
      'friend_id', p_friend_id,
      'timestamp', NOW()
    )
  );
END;
$$;

-- Create the missing debug_friendship_access function
CREATE OR REPLACE FUNCTION debug_friendship_access(
  p_current_user_id UUID,
  p_page_owner_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  friendship_exists BOOLEAN := FALSE;
  friendship_direction TEXT := 'none';
  result JSON;
BEGIN
  -- Check friendship in both directions
  IF EXISTS(
    SELECT 1 FROM friends 
    WHERE user_id = p_current_user_id AND friend_id = p_page_owner_id
  ) THEN
    friendship_exists := TRUE;
    friendship_direction := 'current_user_to_owner';
  ELSIF EXISTS(
    SELECT 1 FROM friends 
    WHERE user_id = p_page_owner_id AND friend_id = p_current_user_id
  ) THEN
    friendship_exists := TRUE;
    friendship_direction := 'owner_to_current_user';
  END IF;
  
  RETURN json_build_object(
    'friendship_exists', friendship_exists,
    'friendship_direction', friendship_direction,
    'current_user_id', p_current_user_id,
    'page_owner_id', p_page_owner_id,
    'debug_timestamp', NOW()
  );
END;
$$;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION test_page_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friendship_and_pages_debug(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_friendship_access(UUID, UUID) TO authenticated;

-- Refresh the schema cache by updating table comments
COMMENT ON TABLE pages IS 'User pages with foreign key to users - updated for schema cache refresh';
COMMENT ON TABLE users IS 'User profiles - updated for schema cache refresh';
COMMENT ON TABLE friends IS 'User friendships - updated for schema cache refresh';

-- Ensure RLS policies are properly set
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
DROP POLICY IF EXISTS "Users can insert their own pages" ON pages;
DROP POLICY IF EXISTS "Users can update their own pages" ON pages;
DROP POLICY IF EXISTS "Users can delete their own pages" ON pages;
DROP POLICY IF EXISTS "Friends can view friends pages" ON pages;

-- Recreate RLS policies with proper logic
CREATE POLICY "Users can view their own pages" ON pages
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own pages" ON pages
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own pages" ON pages
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own pages" ON pages
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Critical policy: Allow friends to view pages with 'friends' visibility
CREATE POLICY "Friends can view friends pages" ON pages
  FOR SELECT USING (
    visibility = 'friends' AND
    EXISTS (
      SELECT 1 FROM friends f
      WHERE (f.user_id::text = auth.uid()::text AND f.friend_id::text = pages.user_id::text)
         OR (f.user_id::text = pages.user_id::text AND f.friend_id::text = auth.uid()::text)
    )
  );

-- Safely ensure pages table is in realtime publication (only if not already there)
DO $
BEGIN
  -- Check if pages table is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'pages'
  ) THEN
    -- Only add if not already there
    ALTER PUBLICATION supabase_realtime ADD TABLE pages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table is already in publication, ignore the error
    NULL;
END $;

-- Create a function to verify the schema setup
CREATE OR REPLACE FUNCTION verify_shared_pages_schema()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  fk_exists BOOLEAN;
  policies_count INTEGER;
  functions_exist JSON;
BEGIN
  -- Check foreign key exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'pages_user_id_fkey'
      AND table_name = 'pages'
  ) INTO fk_exists;
  
  -- Count RLS policies on pages
  SELECT COUNT(*) INTO policies_count
  FROM pg_policies 
  WHERE tablename = 'pages';
  
  -- Check if functions exist
  SELECT json_build_object(
    'test_page_access', EXISTS(
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' AND p.proname = 'test_page_access'
    ),
    'get_friendship_and_pages_debug', EXISTS(
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' AND p.proname = 'get_friendship_and_pages_debug'
    ),
    'debug_friendship_access', EXISTS(
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' AND p.proname = 'debug_friendship_access'
    )
  ) INTO functions_exist;
  
  RETURN json_build_object(
    'foreign_key_exists', fk_exists,
    'rls_policies_count', policies_count,
    'functions_exist', functions_exist,
    'verification_timestamp', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION verify_shared_pages_schema() TO authenticated;

-- Run verification and log results
SELECT verify_shared_pages_schema() as schema_verification_result;