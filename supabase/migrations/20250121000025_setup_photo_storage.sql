-- Setup Storage bucket and policies for photo uploads
-- Similar to audio storage setup

-- Policy 1: Allow authenticated users to upload their own photos
-- Users can only upload to their own folder: {userId}/{weekId}/...
CREATE POLICY "Users can upload their own photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'::text
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Allow authenticated users to read photos
-- All authenticated users can read photos (needed for viewing friends' reflections)
CREATE POLICY "Users can read photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'photos'::text);

-- Policy 3: Allow authenticated users to delete their own photos
CREATE POLICY "Users can delete their own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'::text
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Allow authenticated users to update their own photos
-- (Optional, but useful if users want to replace a photo)
CREATE POLICY "Users can update their own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'::text
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'photos'::text
  AND auth.uid()::text = (storage.foldername(name))[1]
);
