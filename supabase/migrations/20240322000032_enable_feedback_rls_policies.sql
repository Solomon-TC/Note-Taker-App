-- Step 2: Enable Row Level Security (RLS) policies for feedback system
-- This migration secures the feedback and feedback_votes tables with proper access controls

-- 1) Enable RLS on both tables
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

-- 2) Feedback table policies

-- Anyone logged in can read all feedback
CREATE POLICY "feedback_select_all"
  ON public.feedback
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only author can insert their own feedback
CREATE POLICY "feedback_insert_own"
  ON public.feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only author can update their own feedback
CREATE POLICY "feedback_update_own"
  ON public.feedback
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only author can delete their own feedback
CREATE POLICY "feedback_delete_own"
  ON public.feedback
  FOR DELETE
  USING (auth.uid() = user_id);

-- 3) Feedback_votes table policies

-- Anyone logged in can read all votes
CREATE POLICY "feedback_votes_select_all"
  ON public.feedback_votes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert: user can only vote for themselves
CREATE POLICY "feedback_votes_insert_own"
  ON public.feedback_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Delete: user can only remove their own vote
CREATE POLICY "feedback_votes_delete_own"
  ON public.feedback_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON POLICY "feedback_select_all" ON public.feedback IS 'Allow all authenticated users to read feedback';
COMMENT ON POLICY "feedback_insert_own" ON public.feedback IS 'Allow users to create feedback with their own user_id';
COMMENT ON POLICY "feedback_update_own" ON public.feedback IS 'Allow users to update only their own feedback';
COMMENT ON POLICY "feedback_delete_own" ON public.feedback IS 'Allow users to delete only their own feedback';
COMMENT ON POLICY "feedback_votes_select_all" ON public.feedback_votes IS 'Allow all authenticated users to read votes';
COMMENT ON POLICY "feedback_votes_insert_own" ON public.feedback_votes IS 'Allow users to vote only for themselves';
COMMENT ON POLICY "feedback_votes_delete_own" ON public.feedback_votes IS 'Allow users to remove only their own votes';
