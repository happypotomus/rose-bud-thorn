-- Fix infinite recursion in circle_members RLS policy
-- The policy was checking circle_members from within circle_members, causing recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "View circle members" ON circle_members;

-- Create a simpler policy that doesn't cause recursion
-- For now, allow authenticated users to view circle_members
-- We can tighten this later if needed
CREATE POLICY "View circle members" ON circle_members
  FOR SELECT 
  USING (
    -- Allow if user is authenticated (we'll add more restrictions later)
    auth.uid() IS NOT NULL
  );

