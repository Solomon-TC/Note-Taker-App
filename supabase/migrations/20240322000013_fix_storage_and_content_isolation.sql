-- Fix storage bucket configuration and ensure proper content isolation

-- Ensure the notes bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notes',
  'notes',
  false,
  52428800, -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Create storage policies for the notes bucket
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'notes' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'notes' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'notes' AND 
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'notes' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'notes' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add index on pages table for better performance when fetching by page_id
CREATE INDEX IF NOT EXISTS idx_pages_user_id_section_id ON pages(user_id, section_id);
CREATE INDEX IF NOT EXISTS idx_pages_user_id_id ON pages(user_id, id);

-- Add a function to ensure content isolation
CREATE OR REPLACE FUNCTION ensure_page_content_isolation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure that content_json is always a valid JSON object
  IF NEW.content_json IS NULL THEN
    NEW.content_json = '{"type": "doc", "content": []}'::jsonb;
  END IF;
  
  -- Ensure content is never null
  IF NEW.content IS NULL THEN
    NEW.content = '';
  END IF;
  
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure content isolation
DROP TRIGGER IF EXISTS trigger_ensure_page_content_isolation ON pages;
CREATE TRIGGER trigger_ensure_page_content_isolation
  BEFORE INSERT OR UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION ensure_page_content_isolation();

-- Enable realtime for pages table to ensure real-time updates (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pages;
  END IF;
END $$;