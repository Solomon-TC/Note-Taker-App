-- Fix pages.content column to be JSONB type with proper defaults
-- This migration is idempotent and safe to run multiple times

-- First, add content_json column if it doesn't exist
ALTER TABLE pages 
ADD COLUMN IF NOT EXISTS content_json JSONB;

-- Update content_json column to be JSONB with proper conversion
ALTER TABLE pages
ALTER COLUMN content_json TYPE JSONB USING
  CASE
    WHEN content_json IS NOT NULL AND jsonb_typeof(content_json::jsonb) IS NOT NULL THEN content_json::jsonb
    WHEN content IS NOT NULL AND content != '' THEN 
      CASE 
        WHEN content ~ '^\s*[{\[]' THEN content::jsonb
        ELSE jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', content)))))
      END
    ELSE '{"type":"doc","content":[]}'::jsonb
  END,
ALTER COLUMN content_json SET NOT NULL,
ALTER COLUMN content_json SET DEFAULT '{"type":"doc","content":[]}'::jsonb;

-- Update any existing NULL values
UPDATE pages 
SET content_json = '{"type":"doc","content":[]}'::jsonb 
WHERE content_json IS NULL;

-- Enable realtime for pages table (only if not already added)
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'pages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE pages;
    END IF;
END $;
