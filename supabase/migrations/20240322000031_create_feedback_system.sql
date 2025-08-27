-- Step 1: Create feedback + feedback_votes tables (migration + triggers + indexes)
-- This creates a feedback system where feedback is ranked by upvotes in real time
-- Uses denormalized vote_count on feedback table, maintained by DB triggers

-- Ensure pgcrypto exists for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Create feedback_votes table
CREATE TABLE IF NOT EXISTS public.feedback_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_vote_unique UNIQUE (feedback_id, user_id)
);

-- 3) Indexes to speed reads
CREATE INDEX IF NOT EXISTS idx_feedback_vote_count_created ON public.feedback (vote_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback (user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback_id ON public.feedback_votes (feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user_feedback ON public.feedback_votes (user_id, feedback_id);

-- 4) Trigger function to keep vote_count up-to-date
CREATE OR REPLACE FUNCTION public._feedback_votes_count_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- On insert, increment vote_count
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.feedback
      SET vote_count = vote_count + 1
      WHERE id = NEW.feedback_id;
    RETURN NEW;
  END IF;

  -- On delete, decrement vote_count (never below 0)
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.feedback
      SET vote_count = GREATEST(vote_count - 1, 0)
      WHERE id = OLD.feedback_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 5) Triggers for insert/delete on feedback_votes
DROP TRIGGER IF EXISTS trg_feedback_votes_count_on_change ON public.feedback_votes;

CREATE TRIGGER trg_feedback_votes_count_on_change
AFTER INSERT OR DELETE ON public.feedback_votes
FOR EACH ROW
EXECUTE FUNCTION public._feedback_votes_count_trigger();

-- Enable realtime for feedback table (for live leaderboard updates)
alter publication supabase_realtime add table public.feedback;
alter publication supabase_realtime add table public.feedback_votes;
