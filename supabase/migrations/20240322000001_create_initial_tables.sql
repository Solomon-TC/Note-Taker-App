-- Create users table (parallel to auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  note_count INTEGER DEFAULT 0 CHECK (note_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_progress table
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  level INTEGER DEFAULT 1 CHECK (level >= 1),
  current_xp INTEGER DEFAULT 0 CHECK (current_xp >= 0),
  max_xp INTEGER DEFAULT 100 CHECK (max_xp > 0),
  streak_days INTEGER DEFAULT 0 CHECK (streak_days >= 0),
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 0 CHECK (xp_reward >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Create ai_summaries table
CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create practice_problems table
CREATE TABLE IF NOT EXISTS public.practice_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_answer INTEGER NOT NULL CHECK (correct_answer >= 0),
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classes_user_id ON public.classes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_class_id ON public.notes(class_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_note_id ON public.ai_summaries(note_id);
CREATE INDEX IF NOT EXISTS idx_practice_problems_note_id ON public.practice_problems(note_id);

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_problems ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
ON public.users FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create RLS policies for classes table
DROP POLICY IF EXISTS "Users can view own classes" ON public.classes;
CREATE POLICY "Users can view own classes"
ON public.classes FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own classes" ON public.classes;
CREATE POLICY "Users can insert own classes"
ON public.classes FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own classes" ON public.classes;
CREATE POLICY "Users can update own classes"
ON public.classes FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own classes" ON public.classes;
CREATE POLICY "Users can delete own classes"
ON public.classes FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for notes table
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
CREATE POLICY "Users can view own notes"
ON public.notes FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
CREATE POLICY "Users can insert own notes"
ON public.notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
CREATE POLICY "Users can update own notes"
ON public.notes FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
CREATE POLICY "Users can delete own notes"
ON public.notes FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for user_progress table
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress;
CREATE POLICY "Users can view own progress"
ON public.user_progress FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;
CREATE POLICY "Users can update own progress"
ON public.user_progress FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;
CREATE POLICY "Users can insert own progress"
ON public.user_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for achievements table (public read access)
DROP POLICY IF EXISTS "Anyone can view achievements" ON public.achievements;
CREATE POLICY "Anyone can view achievements"
ON public.achievements FOR SELECT
USING (true);

-- Create RLS policies for user_achievements table
DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
CREATE POLICY "Users can view own achievements"
ON public.user_achievements FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;
CREATE POLICY "Users can insert own achievements"
ON public.user_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for ai_summaries table
DROP POLICY IF EXISTS "Users can view own AI summaries" ON public.ai_summaries;
CREATE POLICY "Users can view own AI summaries"
ON public.ai_summaries FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own AI summaries" ON public.ai_summaries;
CREATE POLICY "Users can insert own AI summaries"
ON public.ai_summaries FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own AI summaries" ON public.ai_summaries;
CREATE POLICY "Users can delete own AI summaries"
ON public.ai_summaries FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for practice_problems table
DROP POLICY IF EXISTS "Users can view own practice problems" ON public.practice_problems;
CREATE POLICY "Users can view own practice problems"
ON public.practice_problems FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own practice problems" ON public.practice_problems;
CREATE POLICY "Users can insert own practice problems"
ON public.practice_problems FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own practice problems" ON public.practice_problems;
CREATE POLICY "Users can update own practice problems"
ON public.practice_problems FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own practice problems" ON public.practice_problems;
CREATE POLICY "Users can delete own practice problems"
ON public.practice_problems FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for all tables (only if not already added)
DO $$
BEGIN
  -- Add tables to realtime publication if they're not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'classes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_progress;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'achievements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.achievements;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_achievements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'ai_summaries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_summaries;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'practice_problems'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_problems;
  END IF;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at (with conditional creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_users_updated_at') THEN
    CREATE TRIGGER handle_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_classes_updated_at') THEN
    CREATE TRIGGER handle_classes_updated_at
      BEFORE UPDATE ON public.classes
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_notes_updated_at') THEN
    CREATE TRIGGER handle_notes_updated_at
      BEFORE UPDATE ON public.notes
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_user_progress_updated_at') THEN
    CREATE TRIGGER handle_user_progress_updated_at
      BEFORE UPDATE ON public.user_progress
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Function to automatically create user_progress when user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_progress (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create user_progress for new users (with conditional creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_user_created') THEN
    CREATE TRIGGER on_user_created
      AFTER INSERT ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Function to update class note_count when notes are added/removed
CREATE OR REPLACE FUNCTION public.update_class_note_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.class_id IS NOT NULL THEN
      UPDATE public.classes 
      SET note_count = note_count + 1,
          updated_at = NOW()
      WHERE id = NEW.class_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.class_id IS NOT NULL THEN
      UPDATE public.classes 
      SET note_count = GREATEST(note_count - 1, 0),
          updated_at = NOW()
      WHERE id = OLD.class_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle class_id changes
    IF OLD.class_id IS DISTINCT FROM NEW.class_id THEN
      -- Decrease count for old class
      IF OLD.class_id IS NOT NULL THEN
        UPDATE public.classes 
        SET note_count = GREATEST(note_count - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.class_id;
      END IF;
      -- Increase count for new class
      IF NEW.class_id IS NOT NULL THEN
        UPDATE public.classes 
        SET note_count = note_count + 1,
            updated_at = NOW()
        WHERE id = NEW.class_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain class note_count (with conditional creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_class_note_count_on_insert') THEN
    CREATE TRIGGER update_class_note_count_on_insert
      AFTER INSERT ON public.notes
      FOR EACH ROW EXECUTE FUNCTION public.update_class_note_count();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_class_note_count_on_delete') THEN
    CREATE TRIGGER update_class_note_count_on_delete
      AFTER DELETE ON public.notes
      FOR EACH ROW EXECUTE FUNCTION public.update_class_note_count();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_class_note_count_on_update') THEN
    CREATE TRIGGER update_class_note_count_on_update
      AFTER UPDATE ON public.notes
      FOR EACH ROW EXECUTE FUNCTION public.update_class_note_count();
  END IF;
END $$;