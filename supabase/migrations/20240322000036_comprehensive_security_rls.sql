-- Comprehensive Security RLS Migration (Schema-Aware)
-- This migration implements production-ready Row Level Security policies
-- for all tables in the Scribly application

-- ============================================================================
-- USERS TABLE SECURITY
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view public profile data" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

-- Policy: Users can view limited public profile data
CREATE POLICY "Users can view public profile data"
ON users FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- NOTEBOOKS TABLE SECURITY
-- ============================================================================

-- Enable RLS on notebooks table
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can manage their own notebooks" ON notebooks;

-- Policy: Users can manage their own notebooks
CREATE POLICY "Users can manage their own notebooks"
ON notebooks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SECTIONS TABLE SECURITY
-- ============================================================================

-- Enable RLS on sections table
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can manage their own sections" ON sections;

-- Policy: Users can manage their own sections
CREATE POLICY "Users can manage their own sections"
ON sections FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- PAGES TABLE SECURITY (Notes)
-- ============================================================================

-- First, add visibility column to pages if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pages' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE pages ADD COLUMN visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'public'));
  END IF;
END $$;

-- Enable RLS on pages table
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can manage their own pages" ON pages;
DROP POLICY IF EXISTS "Friends can view pages with friends visibility" ON pages;
DROP POLICY IF EXISTS "Anyone can view public pages" ON pages;

-- Policy: Users can manage their own pages
CREATE POLICY "Users can manage their own pages"
ON pages FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Friends can view pages with 'friends' visibility (if friends table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friends') THEN
    CREATE POLICY "Friends can view pages with friends visibility"
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
  END IF;
END $$;

-- Policy: Anyone can view public pages
CREATE POLICY "Anyone can view public pages"
ON pages FOR SELECT
USING (visibility = 'public' AND auth.role() = 'authenticated');

-- ============================================================================
-- FRIENDS TABLE SECURITY (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friends') THEN
    -- Enable RLS on friends table
    ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own friendships" ON friends;
    DROP POLICY IF EXISTS "Users can manage their own friendships" ON friends;
    
    -- Policy: Users can only see friendships they are part of
    CREATE POLICY "Users can view their own friendships"
    ON friends FOR SELECT
    USING (user_id = auth.uid() OR friend_id = auth.uid());
    
    -- Policy: Users can manage their own friendships
    CREATE POLICY "Users can manage their own friendships"
    ON friends FOR ALL
    USING (user_id = auth.uid() OR friend_id = auth.uid())
    WITH CHECK (user_id = auth.uid() OR friend_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- FRIEND_REQUESTS TABLE SECURITY (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friend_requests') THEN
    -- Enable RLS on friend_requests table
    ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own friend requests" ON friend_requests;
    DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
    DROP POLICY IF EXISTS "Users can respond to friend requests" ON friend_requests;
    DROP POLICY IF EXISTS "Users can delete sent friend requests" ON friend_requests;
    
    -- Policy: Users can view friend requests they sent or received
    CREATE POLICY "Users can view their own friend requests"
    ON friend_requests FOR SELECT
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());
    
    -- Policy: Users can send friend requests
    CREATE POLICY "Users can send friend requests"
    ON friend_requests FOR INSERT
    WITH CHECK (sender_id = auth.uid());
    
    -- Policy: Users can update friend requests they received
    CREATE POLICY "Users can respond to friend requests"
    ON friend_requests FOR UPDATE
    USING (receiver_id = auth.uid())
    WITH CHECK (receiver_id = auth.uid());
    
    -- Policy: Users can delete friend requests they sent
    CREATE POLICY "Users can delete sent friend requests"
    ON friend_requests FOR DELETE
    USING (sender_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- FEEDBACK TABLE SECURITY (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'feedback') THEN
    -- Enable RLS on feedback table
    ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Anyone can view feedback" ON feedback;
    DROP POLICY IF EXISTS "Users can create feedback" ON feedback;
    DROP POLICY IF EXISTS "Authors can update their feedback" ON feedback;
    DROP POLICY IF EXISTS "Authors can delete their feedback" ON feedback;
    
    -- Policy: Authenticated users can view all feedback
    CREATE POLICY "Anyone can view feedback"
    ON feedback FOR SELECT
    USING (auth.role() = 'authenticated');
    
    -- Policy: Users can create feedback with their own user_id
    CREATE POLICY "Users can create feedback"
    ON feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);
    
    -- Policy: Authors can update their own feedback
    CREATE POLICY "Authors can update their feedback"
    ON feedback FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
    
    -- Policy: Authors can delete their own feedback
    CREATE POLICY "Authors can delete their feedback"
    ON feedback FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- FEEDBACK_VOTES TABLE SECURITY (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'feedback_votes') THEN
    -- Enable RLS on feedback_votes table
    ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Anyone can view feedback votes" ON feedback_votes;
    DROP POLICY IF EXISTS "Users can vote on feedback" ON feedback_votes;
    DROP POLICY IF EXISTS "Users can remove their votes" ON feedback_votes;
    
    -- Policy: Authenticated users can view all feedback votes
    CREATE POLICY "Anyone can view feedback votes"
    ON feedback_votes FOR SELECT
    USING (auth.role() = 'authenticated');
    
    -- Policy: Users can vote on feedback with their own user_id
    CREATE POLICY "Users can vote on feedback"
    ON feedback_votes FOR INSERT
    WITH CHECK (auth.uid() = user_id);
    
    -- Policy: Users can remove their own votes
    CREATE POLICY "Users can remove their votes"
    ON feedback_votes FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- AI_SESSIONS TABLE SECURITY (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_sessions') THEN
    ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can manage their own AI sessions" ON ai_sessions;
    
    -- Policy: Users can only access their own AI sessions
    CREATE POLICY "Users can manage their own AI sessions"
    ON ai_sessions FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- DRAWINGS TABLE SECURITY (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'drawings') THEN
    ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can manage their own drawings" ON drawings;
    
    -- Policy: Users can only access their own drawings
    CREATE POLICY "Users can manage their own drawings"
    ON drawings FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;