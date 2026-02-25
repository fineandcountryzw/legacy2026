-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  false,
  10485760, -- 10MB limit
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to their own folder" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own uploads
CREATE POLICY "Users can read their own uploads" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own uploads" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
