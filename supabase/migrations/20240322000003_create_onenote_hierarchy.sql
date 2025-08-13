-- Create notebooks table (extends the concept of classes)
CREATE TABLE IF NOT EXISTS notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sections table
CREATE TABLE IF NOT EXISTS sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pages table (extends the concept of notes)
CREATE TABLE IF NOT EXISTS pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Page',
  content TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_sort_order ON notebooks(sort_order);
CREATE INDEX IF NOT EXISTS idx_sections_notebook_id ON sections(notebook_id);
CREATE INDEX IF NOT EXISTS idx_sections_user_id ON sections(user_id);
CREATE INDEX IF NOT EXISTS idx_sections_sort_order ON sections(sort_order);
CREATE INDEX IF NOT EXISTS idx_pages_section_id ON pages(section_id);
CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_parent_page_id ON pages(parent_page_id);
CREATE INDEX IF NOT EXISTS idx_pages_sort_order ON pages(sort_order);

-- Enable realtime for all tables (only if not already added)
DO $$
BEGIN
    -- Add notebooks table to realtime if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notebooks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notebooks;
    END IF;
    
    -- Add sections table to realtime if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'sections'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sections;
    END IF;
    
    -- Add pages table to realtime if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'pages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE pages;
    END IF;
END
$$;

-- Create trigger functions for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist and create new ones
DROP TRIGGER IF EXISTS update_notebooks_updated_at ON notebooks;
CREATE TRIGGER update_notebooks_updated_at BEFORE UPDATE ON notebooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sections_updated_at ON sections;
CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pages_updated_at ON pages;
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing data from classes to notebooks
INSERT INTO notebooks (id, user_id, name, description, sort_order, created_at, updated_at)
SELECT id, user_id, name, description, 0, created_at, updated_at
FROM classes
ON CONFLICT (id) DO NOTHING;

-- Create default sections for existing notebooks
INSERT INTO sections (notebook_id, user_id, name, color, sort_order)
SELECT n.id, n.user_id, 'General Notes', '#3b82f6', 0
FROM notebooks n
WHERE NOT EXISTS (
  SELECT 1 FROM sections s WHERE s.notebook_id = n.id
);

-- Migrate existing notes to pages
INSERT INTO pages (section_id, user_id, title, content, sort_order, created_at, updated_at)
SELECT 
  s.id as section_id,
  n.user_id,
  n.title,
  n.content,
  0,
  n.created_at,
  n.updated_at
FROM notes n
JOIN notebooks nb ON n.class_id = nb.id
JOIN sections s ON s.notebook_id = nb.id AND s.name = 'General Notes'
ON CONFLICT DO NOTHING;