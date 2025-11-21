-- Fix RLS policy to explicitly allow unauthenticated users to read circles
-- This is needed for the invite flow before users are authenticated

-- Drop the existing policy
DROP POLICY IF EXISTS "View circles for invites or membership" ON circles;

-- Create a policy that allows:
-- 1. Authenticated users to view circles they're members of
-- 2. Unauthenticated users to view any circle (needed for invite flow)
CREATE POLICY "Allow circle access for invites and members" ON circles
  FOR SELECT 
  USING (
    -- Allow if user is authenticated and is a member
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM circle_members
      WHERE circle_members.circle_id = circles.id
      AND circle_members.user_id = auth.uid()
    ))
    OR
    -- Allow if user is unauthenticated (for invite flow)
    auth.uid() IS NULL
  );

