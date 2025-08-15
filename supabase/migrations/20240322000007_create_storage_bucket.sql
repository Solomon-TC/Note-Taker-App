-- Create storage bucket for notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('notes', 'notes', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create storage policies for notes bucket
-- Policy for authenticated users to upload their own files
CREATE POLICY "Users can upload their own files" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'notes' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for authenticated users to view their own files
CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT USING (
    bucket_id = 'notes' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for authenticated users to update their own files
CREATE POLICY "Users can update their own files" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'notes' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for authenticated users to delete their own files
CREATE POLICY "Users can delete their own files" ON storage.objects
FOR DELETE USING (
    bucket_id = 'notes' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);
