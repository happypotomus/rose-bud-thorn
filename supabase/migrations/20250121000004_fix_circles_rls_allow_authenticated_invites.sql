-- Fix RLS policy to allow authenticated users to read circles by invite_token
-- After OTP verification, user is authenticated but not yet a member
-- They need to be able to read the circle to join it

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow circle access for invites and members" ON circles;

-- Create a policy that allows:
-- 1. Authenticated users to view circles they're members of
-- 2. Unauthenticated users to view any circle (for initial invite lookup)
-- 3. Authenticated users to view circles by invite_token (for joining after OTP)
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
    -- Allow if user is unauthenticated (for initial invite lookup)
    auth.uid() IS NULL
    OR
    -- Allow if circle has an invite_token (for authenticated users joining)
    (auth.uid() IS NOT NULL AND invite_token IS NOT NULL)
  );

