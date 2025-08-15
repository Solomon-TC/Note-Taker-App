-- Enable RLS on drawings table
ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can select their own drawings" ON drawings;
DROP POLICY IF EXISTS "Users can insert their own drawings" ON drawings;
DROP POLICY IF EXISTS "Users can update their own drawings" ON drawings;
DROP POLICY IF EXISTS "Users can delete their own drawings" ON drawings;

-- Create RLS policies for drawings table
CREATE POLICY "Users can select their own drawings"
ON drawings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drawings"
ON drawings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drawings"
ON drawings FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drawings"
ON drawings FOR DELETE
USING (auth.uid() = user_id);

-- Ensure RLS is enabled on notes table and update policies
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can select their own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;

-- Create RLS policies for notes table
CREATE POLICY "Users can select their own notes"
ON notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
ON notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
ON notes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
ON notes FOR DELETE
USING (auth.uid() = user_id);
