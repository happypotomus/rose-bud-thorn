-- Fix RLS policy for circles to allow invite token lookup
-- Users need to be able to read circles by invite_token before they're members

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Members can view their circle" ON circles;

-- Create a new policy that allows:
-- 1. Authenticated users to view circles they're members of
-- 2. Anyone (including unauthenticated) to view circles by invite_token (for joining)
CREATE POLICY "View circles for invites or membership" ON circles
  FOR SELECT USING (
    -- Allow if user is a member
    EXISTS (
      SELECT 1 FROM circle_members
      WHERE circle_members.circle_id = circles.id
      AND circle_members.user_id = auth.uid()
    )
    OR
    -- Allow if checking by invite_token (for invite flow)
    invite_token IS NOT NULL
  );

