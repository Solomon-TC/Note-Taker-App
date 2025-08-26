-- Add visibility column to pages table
-- This migration adds a visibility setting to control who can view each page

-- Add the visibility column with default value and not null constraint
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

-- Add check constraint to enforce only allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pages_visibility_check'
  ) THEN
    ALTER TABLE public.pages
      ADD CONSTRAINT pages_visibility_check
      CHECK (visibility IN ('private', 'friends'));
  END IF;
END$$;

-- Ensure all existing rows have the default value (should already be true via DEFAULT)
UPDATE public.pages 
SET visibility = 'private' 
WHERE visibility IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.pages.visibility IS 'Controls who can view this page: private (only author) or friends (author and their friends)';
