-- Setup Storage bucket and policies for audio recordings
-- Chunk 12: Voice recording + Supabase Storage

-- Note: Bucket creation must be done via Dashboard or API
-- This migration only sets up the storage policies

-- Policy 1: Allow authenticated users to upload their own audio files
-- Users can only upload to their own folder: {userId}/{weekId}/...
CREATE POLICY "Users can upload their own audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio'::text
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Allow authenticated users to read audio files
-- All authenticated users can read audio files (needed for reading friends' reflections)
CREATE POLICY "Users can read audio files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'audio'::text);

-- Policy 3: Allow authenticated users to delete their own audio files
CREATE POLICY "Users can delete their own audio"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio'::text
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Allow authenticated users to update their own audio files
-- (Optional, but useful if users want to replace a recording)
CREATE POLICY "Users can update their own audio"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'audio'::text
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'audio'::text
  AND auth.uid()::text = (storage.foldername(name))[1]
);


