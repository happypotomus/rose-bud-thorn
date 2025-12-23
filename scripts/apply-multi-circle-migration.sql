-- Apply multi-circle migration directly
-- Run this in Supabase SQL Editor if CLI migration fails

-- Drop the existing UNIQUE constraint on user_id
ALTER TABLE circle_members 
DROP CONSTRAINT IF EXISTS circle_members_user_id_key;

-- Add new UNIQUE constraint on (user_id, circle_id) to prevent duplicate memberships in same circle
-- This allows a user to be in multiple circles, but not in the same circle twice
ALTER TABLE circle_members 
ADD CONSTRAINT circle_members_user_id_circle_id_key UNIQUE (user_id, circle_id);

-- Verify the constraint was added
SELECT 
    constraint_name, 
    constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'circle_members' 
    AND constraint_type = 'UNIQUE';



