# Chunk 12 Setup Status

## ✅ Completed

1. **Storage Bucket Created**
   - Bucket name: `audio`
   - Public: Yes (so audio URLs can be accessed)
   - File size limit: 10MB
   - Allowed MIME types: audio/webm, audio/mpeg, audio/wav, audio/ogg

2. **Storage Policies Created** ✅
   - All 4 policies have been applied successfully
   - Users can upload, read, update, and delete their own audio files

## 🎉 Setup Complete!

### Set Up Storage Policies

Storage policies need to be set up manually. You have two options:

#### Option 1: Via Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/wildgnkpmalxvadlmjbj/storage/policies
2. Select the `audio` bucket
3. Click **"New Policy"** for each policy below:

**Policy 1: Users can upload their own audio**
- Policy name: `Users can upload their own audio`
- Allowed operation: `INSERT`
- Policy definition:
  ```sql
  (bucket_id = 'audio'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
  ```
- This ensures users can only upload to their own folder (`{userId}/...`)

**Policy 2: Users can read audio files**
- Policy name: `Users can read audio files`
- Allowed operation: `SELECT`
- Policy definition:
  ```sql
  bucket_id = 'audio'::text
  ```
- This allows all authenticated users to read audio files (needed for reading friends' reflections)

**Policy 3: Users can delete their own audio**
- Policy name: `Users can delete their own audio`
- Allowed operation: `DELETE`
- Policy definition:
  ```sql
  (bucket_id = 'audio'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
  ```

**Policy 4: Users can update their own audio** (Optional)
- Policy name: `Users can update their own audio`
- Allowed operation: `UPDATE`
- Policy definition (USING):
  ```sql
  (bucket_id = 'audio'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
  ```
- Policy definition (WITH CHECK):
  ```sql
  (bucket_id = 'audio'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
  ```

#### Option 2: Via SQL Editor

1. Go to: https://supabase.com/dashboard/project/wildgnkpmalxvadlmjbj/sql/new
2. Copy and paste the SQL from: `supabase/migrations/20250121000016_setup_audio_storage.sql`
3. Click **"Run"**

## Testing

Once policies are set up:

1. Go to `/reflection` in your app
2. Click **"Record"** for any section (Rose/Bud/Thorn)
3. Record some audio
4. Click **"Stop"**
5. Click **"Keep & Upload"**
6. Verify the upload succeeds
7. Check that the file appears in Storage → `audio` bucket

## File Structure

Audio files are stored as:
```
audio/
  {userId}/
    {weekId}/
      rose_{timestamp}.webm
      bud_{timestamp}.webm
      thorn_{timestamp}.webm
```

This structure:
- Keeps files organized by user and week
- Supports the RLS policy (users can only access their own folder)
- Makes it easy to manage and clean up old files

## Troubleshooting

### "Permission denied" when uploading
- Verify all 4 policies are created
- Check that you're authenticated
- Ensure the bucket is public

### Upload fails silently
- Check browser console for errors
- Verify file size is under 10MB
- Check network tab for failed requests

### "Bucket not found"
- Verify bucket name is exactly `audio` (case-sensitive)
- Check that Storage is enabled in your project

