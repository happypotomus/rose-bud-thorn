-- Add INSERT policies for all tables that need them
-- Pattern: We've been missing INSERT policies throughout

-- 1. circle_members: Users can add themselves to a circle (via invite flow)
CREATE POLICY "Users can insert own circle membership" ON circle_members
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 2. notification_logs: System can log notifications (will be needed in Chunks 10-11)
-- For now, allow authenticated users (we'll restrict this later when we add service role)
CREATE POLICY "Allow notification log inserts" ON notification_logs
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Note: 
-- - profiles INSERT policy was already added in migration 20250121000005
-- - reflections INSERT policy already exists in initial schema
-- - weeks table is created by cron/Edge Functions, so we'll handle that separately

