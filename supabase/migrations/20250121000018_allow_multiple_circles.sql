-- Allow multiple circles per user
-- Remove UNIQUE(user_id) constraint and add UNIQUE(user_id, circle_id) constraint
-- This enables users to be members of multiple circles

-- Drop the existing UNIQUE constraint on user_id
ALTER TABLE circle_members 
DROP CONSTRAINT IF EXISTS circle_members_user_id_key;

-- Add new UNIQUE constraint on (user_id, circle_id) to prevent duplicate memberships in same circle
-- This allows a user to be in multiple circles, but not in the same circle twice
ALTER TABLE circle_members 
ADD CONSTRAINT circle_members_user_id_circle_id_key UNIQUE (user_id, circle_id);

-- Note: RLS policies should continue to work as they check membership per circle
-- No changes needed to RLS policies



