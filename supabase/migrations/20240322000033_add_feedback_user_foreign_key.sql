-- Add foreign key constraint between feedback and users tables
-- This enables proper joins for the feedback leaderboard

-- First, ensure the constraint doesn't already exist
DO $$
BEGIN
    -- Check if the foreign key constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'feedback_user_id_fkey' 
        AND table_name = 'feedback'
    ) THEN
        -- Add the foreign key constraint
        ALTER TABLE feedback 
        ADD CONSTRAINT feedback_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key constraint feedback_user_id_fkey created successfully';
    ELSE
        RAISE NOTICE 'Foreign key constraint feedback_user_id_fkey already exists';
    END IF;
END $$;

-- Ensure RLS policies allow global read access for feedback leaderboard
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all users to read all feedback" ON feedback;
DROP POLICY IF EXISTS "Allow users to insert their own feedback" ON feedback;
DROP POLICY IF EXISTS "Allow users to update their own feedback" ON feedback;

-- Create comprehensive RLS policies for feedback
CREATE POLICY "Allow all users to read all feedback"
ON feedback FOR SELECT
USING (true);

CREATE POLICY "Allow users to insert their own feedback"
ON feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own feedback"
ON feedback FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure users table has proper read access for joins
DROP POLICY IF EXISTS "Allow all users to read user profiles" ON users;

CREATE POLICY "Allow all users to read user profiles"
ON users FOR SELECT
USING (true);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';