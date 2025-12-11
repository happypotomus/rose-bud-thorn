# Chunk 12 - Supabase Storage Setup

This guide explains how to set up the Supabase Storage bucket for audio recordings.

## Prerequisites

- Supabase project with Storage enabled
- Access to Supabase Dashboard

## Setup Steps

### 1. Create Storage Bucket

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/wildgnkpmalxvadlmjbj/storage/buckets
2. Click **"New bucket"**
3. Configure the bucket:
   - **Name**: `audio`
   - **Public bucket**: ✅ **Yes** (so audio URLs can be accessed)
   - **File size limit**: Leave default or set to reasonable limit (e.g., 10MB)
   - **Allowed MIME types**: `audio/webm`, `audio/mpeg`, `audio/wav` (optional, for flexibility)

4. Click **"Create bucket"**

### 2. Set Up Storage Policies (RLS)

The bucket needs RLS policies so users can upload their own audio files.

1. Go to Storage → Policies → `audio` bucket
2. Click **"New Policy"**

**Policy 1: Allow authenticated users to upload**
- Policy name: "Users can upload their own audio"
- Allowed operation: `INSERT`
- Policy definition:
  ```sql
  (bucket_id = 'audio'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
  ```
  This ensures users can only upload to their own folder (`{userId}/...`)

**Policy 2: Allow authenticated users to read**
- Policy name: "Users can read audio files"
- Allowed operation: `SELECT`
- Policy definition:
  ```sql
  bucket_id = 'audio'::text
  ```
  This allows all authenticated users to read audio files (needed for reading friends' reflections)

**Policy 3: Allow authenticated users to delete their own files**
- Policy name: "Users can delete their own audio"
- Allowed operation: `DELETE`
- Policy definition:
  ```sql
  (bucket_id = 'audio'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
  ```

### 3. Verify Setup

You can test the setup by:
1. Going to the reflection page
2. Recording audio for any section
3. Uploading it
4. Checking that the file appears in Storage → `audio` bucket

## File Structure

Audio files are stored with this structure:
```
audio/
  {userId}/
    {weekId}/
      rose_{timestamp}.webm
      bud_{timestamp}.webm
      thorn_{timestamp}.webm
```

This organization:
- Keeps files organized by user and week
- Makes it easy to find and manage files
- Supports the RLS policy structure

## Troubleshooting

### "Bucket not found" error
- Ensure the bucket is named exactly `audio` (case-sensitive)
- Check that Storage is enabled in your Supabase project

### "Permission denied" error
- Verify RLS policies are set up correctly
- Check that the user is authenticated
- Ensure the bucket is public (for reading)

### Upload fails silently
- Check browser console for errors
- Verify file size is within limits
- Check network tab for failed requests


