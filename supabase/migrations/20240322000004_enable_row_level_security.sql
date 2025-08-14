-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_problems ENABLE ROW LEVEL SECURITY;

-- Users table policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- Notebooks table policies
DROP POLICY IF EXISTS "Users can view own notebooks" ON notebooks;
CREATE POLICY "Users can view own notebooks"
ON notebooks FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notebooks" ON notebooks;
CREATE POLICY "Users can insert own notebooks"
ON notebooks FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notebooks" ON notebooks;
CREATE POLICY "Users can update own notebooks"
ON notebooks FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notebooks" ON notebooks;
CREATE POLICY "Users can delete own notebooks"
ON notebooks FOR DELETE
USING (auth.uid() = user_id);

-- Sections table policies
DROP POLICY IF EXISTS "Users can view own sections" ON sections;
CREATE POLICY "Users can view own sections"
ON sections FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sections" ON sections;
CREATE POLICY "Users can insert own sections"
ON sections FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sections" ON sections;
CREATE POLICY "Users can update own sections"
ON sections FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sections" ON sections;
CREATE POLICY "Users can delete own sections"
ON sections FOR DELETE
USING (auth.uid() = user_id);

-- Pages table policies
DROP POLICY IF EXISTS "Users can view own pages" ON pages;
CREATE POLICY "Users can view own pages"
ON pages FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pages" ON pages;
CREATE POLICY "Users can insert own pages"
ON pages FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pages" ON pages;
CREATE POLICY "Users can update own pages"
ON pages FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own pages" ON pages;
CREATE POLICY "Users can delete own pages"
ON pages FOR DELETE
USING (auth.uid() = user_id);

-- Notes table policies
DROP POLICY IF EXISTS "Users can view own notes" ON notes;
CREATE POLICY "Users can view own notes"
ON notes FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
CREATE POLICY "Users can insert own notes"
ON notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notes" ON notes;
CREATE POLICY "Users can update own notes"
ON notes FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
CREATE POLICY "Users can delete own notes"
ON notes FOR DELETE
USING (auth.uid() = user_id);

-- Classes table policies
DROP POLICY IF EXISTS "Users can view own classes" ON classes;
CREATE POLICY "Users can view own classes"
ON classes FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own classes" ON classes;
CREATE POLICY "Users can insert own classes"
ON classes FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own classes" ON classes;
CREATE POLICY "Users can update own classes"
ON classes FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own classes" ON classes;
CREATE POLICY "Users can delete own classes"
ON classes FOR DELETE
USING (auth.uid() = user_id);

-- User progress table policies
DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
CREATE POLICY "Users can view own progress"
ON user_progress FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
CREATE POLICY "Users can insert own progress"
ON user_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
CREATE POLICY "Users can update own progress"
ON user_progress FOR UPDATE
USING (auth.uid() = user_id);

-- User achievements table policies
DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
CREATE POLICY "Users can view own achievements"
ON user_achievements FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;
CREATE POLICY "Users can insert own achievements"
ON user_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- AI summaries table policies
DROP POLICY IF EXISTS "Users can view own ai summaries" ON ai_summaries;
CREATE POLICY "Users can view own ai summaries"
ON ai_summaries FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ai summaries" ON ai_summaries;
CREATE POLICY "Users can insert own ai summaries"
ON ai_summaries FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ai summaries" ON ai_summaries;
CREATE POLICY "Users can update own ai summaries"
ON ai_summaries FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ai summaries" ON ai_summaries;
CREATE POLICY "Users can delete own ai summaries"
ON ai_summaries FOR DELETE
USING (auth.uid() = user_id);

-- Practice problems table policies
DROP POLICY IF EXISTS "Users can view own practice problems" ON practice_problems;
CREATE POLICY "Users can view own practice problems"
ON practice_problems FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own practice problems" ON practice_problems;
CREATE POLICY "Users can insert own practice problems"
ON practice_problems FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own practice problems" ON practice_problems;
CREATE POLICY "Users can update own practice problems"
ON practice_problems FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own practice problems" ON practice_problems;
CREATE POLICY "Users can delete own practice problems"
ON practice_problems FOR DELETE
USING (auth.uid() = user_id);

-- Achievements table policies (public read access)
DROP POLICY IF EXISTS "Public read access to achievements" ON achievements;
CREATE POLICY "Public read access to achievements"
ON achievements FOR SELECT
USING (true);
