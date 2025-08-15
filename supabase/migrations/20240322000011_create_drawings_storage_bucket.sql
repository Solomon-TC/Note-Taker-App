-- Create the drawings storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('drawings', 'drawings', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the drawings bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'drawings');
CREATE POLICY "Authenticated users can upload drawings" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'drawings' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own drawings" ON storage.objects FOR UPDATE USING (bucket_id = 'drawings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own drawings" ON storage.objects FOR DELETE USING (bucket_id = 'drawings' AND auth.uid()::text = (storage.foldername(name))[1]);
