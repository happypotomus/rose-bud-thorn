-- Add photo fields to reflections table
-- Allows users to upload a photo with optional caption for their weekly reflection

ALTER TABLE reflections
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS photo_caption TEXT;
