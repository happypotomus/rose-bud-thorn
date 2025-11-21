-- Add INSERT policy for weeks table
-- The RPC function get_or_create_current_week() needs to be able to insert weeks
-- Since it uses SECURITY DEFINER, it runs with elevated privileges, but we still need the policy

-- Allow the function to insert weeks (it runs as the function owner)
-- For now, allow authenticated users to insert (the function will handle the logic)
CREATE POLICY "Allow week creation via RPC" ON weeks
  FOR INSERT 
  WITH CHECK (true);

-- Note: The RPC function uses SECURITY DEFINER, so it can bypass RLS if needed
-- But having the policy is cleaner and more explicit

