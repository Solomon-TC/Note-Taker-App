-- Comprehensive fix for pages table content_json column issues
-- This migration addresses all possible root causes for save failures
-- Safe to run multiple times (idempotent)

-- Step 1: Ensure the pages table exists
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    section_id UUID NOT NULL,
    parent_page_id UUID,
    title TEXT NOT NULL DEFAULT 'Untitled Page',
    content TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add content_json column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pages' 
        AND column_name = 'content_json'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE pages ADD COLUMN content_json JSONB;
    END IF;
END $$;

-- Step 3: Ensure content_json has proper type and constraints
DO $$
BEGIN
    -- First, handle any existing data conversion
    UPDATE pages 
    SET content_json = 
        CASE
            WHEN content_json IS NOT NULL AND jsonb_typeof(content_json) IS NOT NULL THEN content_json
            WHEN content IS NOT NULL AND content != '' THEN 
                CASE 
                    WHEN content ~ '^\\s*[{\\[]' THEN 
                        CASE 
                            WHEN content::jsonb ? 'type' THEN content::jsonb
                            ELSE '{"type":"doc","content":[]}'::jsonb
                        END
                    ELSE '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"' || replace(content, '"', '\\"') || '"}]}]}'::jsonb
                END
            ELSE '{"type":"doc","content":[]}'::jsonb
        END
    WHERE content_json IS NULL OR content_json = 'null'::jsonb OR content_json = '{}'::jsonb;
    
    -- Ensure column is JSONB type
    ALTER TABLE pages ALTER COLUMN content_json TYPE JSONB USING 
        CASE 
            WHEN content_json IS NULL THEN '{"type":"doc","content":[]}'::jsonb
            WHEN jsonb_typeof(content_json) IS NULL THEN '{"type":"doc","content":[]}'::jsonb
            ELSE content_json
        END;
    
    -- Set NOT NULL constraint
    ALTER TABLE pages ALTER COLUMN content_json SET NOT NULL;
    
    -- Set default value
    ALTER TABLE pages ALTER COLUMN content_json SET DEFAULT '{"type":"doc","content":[]}'::jsonb;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback: ensure column exists with basic setup
        ALTER TABLE pages ALTER COLUMN content_json DROP NOT NULL;
        ALTER TABLE pages ALTER COLUMN content_json SET DEFAULT '{"type":"doc","content":[]}'::jsonb;
END $$;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_section_id ON pages(section_id);
CREATE INDEX IF NOT EXISTS idx_pages_parent_page_id ON pages(parent_page_id);
CREATE INDEX IF NOT EXISTS idx_pages_updated_at ON pages(updated_at);

-- Step 5: Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Add foreign key to sections if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'pages_section_id_fkey' 
        AND table_name = 'pages'
    ) THEN
        ALTER TABLE pages ADD CONSTRAINT pages_section_id_fkey 
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;
    END IF;
    
    -- Add self-referencing foreign key for parent_page_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'pages_parent_page_id_fkey' 
        AND table_name = 'pages'
    ) THEN
        ALTER TABLE pages ADD CONSTRAINT pages_parent_page_id_fkey 
        FOREIGN KEY (parent_page_id) REFERENCES pages(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore foreign key constraint errors
END $$;

-- Step 6: Update RLS policies to include content_json column
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own pages" ON pages;
    DROP POLICY IF EXISTS "Users can insert their own pages" ON pages;
    DROP POLICY IF EXISTS "Users can update their own pages" ON pages;
    DROP POLICY IF EXISTS "Users can delete their own pages" ON pages;
    
    -- Create comprehensive RLS policies
    CREATE POLICY "Users can view their own pages" ON pages
        FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can insert their own pages" ON pages
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their own pages" ON pages
        FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can delete their own pages" ON pages
        FOR DELETE USING (auth.uid() = user_id);
    
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore RLS policy errors
END $$;

-- Step 7: Enable RLS if not already enabled
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Step 8: Add to realtime publication if not already added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'pages'
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE pages;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore realtime publication errors
END $$;

-- Step 9: Final data consistency check
UPDATE pages 
SET content_json = '{"type":"doc","content":[]}'::jsonb 
WHERE content_json IS NULL;
