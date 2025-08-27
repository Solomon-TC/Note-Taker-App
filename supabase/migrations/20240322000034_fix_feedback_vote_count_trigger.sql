-- Fix feedback vote count trigger to work with RLS policies
-- The issue: RLS policies prevent the trigger from updating vote_count properly
-- The solution: Use a SECURITY DEFINER function that bypasses RLS for vote counting

-- 1) Create a SECURITY DEFINER function to update vote counts (bypasses RLS)
CREATE OR REPLACE FUNCTION public._update_feedback_vote_count(feedback_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the vote_count by counting actual votes in feedback_votes table
  -- SECURITY DEFINER allows this function to bypass RLS policies
  UPDATE public.feedback
  SET vote_count = (
    SELECT COUNT(*)
    FROM public.feedback_votes
    WHERE feedback_votes.feedback_id = feedback_id_param
  )
  WHERE id = feedback_id_param;
END;
$$;

-- 2) Update the trigger function to use the SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public._feedback_votes_count_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- On insert, update vote_count using SECURITY DEFINER function
  IF (TG_OP = 'INSERT') THEN
    PERFORM public._update_feedback_vote_count(NEW.feedback_id);
    RETURN NEW;
  END IF;

  -- On delete, update vote_count using SECURITY DEFINER function
  IF (TG_OP = 'DELETE') THEN
    PERFORM public._update_feedback_vote_count(OLD.feedback_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 3) Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trg_feedback_votes_count_on_change ON public.feedback_votes;

CREATE TRIGGER trg_feedback_votes_count_on_change
AFTER INSERT OR DELETE ON public.feedback_votes
FOR EACH ROW
EXECUTE FUNCTION public._feedback_votes_count_trigger();

-- 4) Fix any existing vote counts that may be incorrect
-- This recalculates vote_count for all feedback items based on actual votes
UPDATE public.feedback
SET vote_count = (
  SELECT COUNT(*)
  FROM public.feedback_votes
  WHERE feedback_votes.feedback_id = feedback.id
);

-- 5) Add a function to manually recalculate vote counts if needed
CREATE OR REPLACE FUNCTION public.recalculate_all_feedback_vote_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recalculate vote_count for all feedback items
  UPDATE public.feedback
  SET vote_count = (
    SELECT COUNT(*)
    FROM public.feedback_votes
    WHERE feedback_votes.feedback_id = feedback.id
  );
  
  RAISE NOTICE 'Recalculated vote counts for all feedback items';
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public._update_feedback_vote_count(uuid) IS 'Updates vote count for a specific feedback item, bypassing RLS';
COMMENT ON FUNCTION public._feedback_votes_count_trigger() IS 'Trigger function to maintain vote_count when votes are added/removed';
COMMENT ON FUNCTION public.recalculate_all_feedback_vote_counts() IS 'Utility function to recalculate all feedback vote counts';
