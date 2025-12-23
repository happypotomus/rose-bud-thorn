-- Complete Dev Database Setup Script
-- Run this in Supabase SQL Editor to set up a fresh dev database with multi-circle support
-- This combines the initial schema with the multi-circle migration already applied

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. profiles
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. circles
-- ============================================
CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  circle_owner TEXT,
  invite_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. circle_members (WITH MULTI-CIRCLE SUPPORT)
-- ============================================
CREATE TABLE IF NOT EXISTS circle_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Allow multiple circles per user, but prevent duplicate memberships in same circle
  UNIQUE(user_id, circle_id)
);

-- ============================================
-- 4. weeks
-- ============================================
CREATE TABLE IF NOT EXISTS weeks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. reflections
-- ============================================
CREATE TABLE IF NOT EXISTS reflections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rose_text TEXT,
  bud_text TEXT,
  thorn_text TEXT,
  rose_audio_url TEXT,
  bud_audio_url TEXT,
  thorn_audio_url TEXT,
  rose_transcript TEXT,
  bud_transcript TEXT,
  thorn_transcript TEXT,
  submitted_at TIMESTAMPTZ,
  -- One reflection per user per circle per week
  UNIQUE(user_id, circle_id, week_id)
);

-- ============================================
-- 6. notification_logs
-- ============================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('first_reminder', 'second_reminder', 'unlock')),
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_circle_members_circle_id ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user_id ON circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_circle_id ON reflections(circle_id);
CREATE INDEX IF NOT EXISTS idx_reflections_week_id ON reflections(week_id);
CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_circle_id ON notification_logs(circle_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_week_id ON notification_logs(week_id);

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile, and view profiles in same circle
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view profiles in same circle" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm1
      JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
      WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = profiles.id
    )
  );

-- Circles: allow access for invites and members
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

-- Circle members: users can view and insert their own memberships
CREATE POLICY "View circle members" ON circle_members
  FOR SELECT USING (
    -- Allow if user is authenticated (simplified for multi-circle support)
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can insert own circle membership" ON circle_members
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Weeks: all authenticated users can view, RPC can insert
CREATE POLICY "Authenticated users can view weeks" ON weeks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow weeks insert for RPC" ON weeks
  FOR INSERT WITH CHECK (true);

-- Reflections: users can view reflections in their circle, and manage their own
CREATE POLICY "View reflections in own circle" ON reflections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members
      WHERE circle_members.circle_id = reflections.circle_id
      AND circle_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own reflection" ON reflections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reflection" ON reflections
  FOR UPDATE USING (auth.uid() = user_id);

-- Notification logs: allow inserts for system, users can view their own
CREATE POLICY "Allow notification log inserts" ON notification_logs
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view own notification logs" ON notification_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- Functions
-- ============================================

-- Function to get or create current week
CREATE OR REPLACE FUNCTION get_or_create_current_week()
RETURNS TABLE (
  id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  now_time TIMESTAMPTZ;
  week_start TIMESTAMPTZ;
  week_end TIMESTAMPTZ;
  current_week_record RECORD;
BEGIN
  now_time := NOW();
  
  -- Find current week (where now_time is between start_at and end_at)
  SELECT * INTO current_week_record
  FROM weeks
  WHERE start_at <= now_time AND now_time < end_at
  LIMIT 1;
  
  -- If week exists, return it
  IF current_week_record IS NOT NULL THEN
    RETURN QUERY SELECT 
      current_week_record.id,
      current_week_record.start_at,
      current_week_record.end_at,
      current_week_record.created_at;
    RETURN;
  END IF;
  
  -- Calculate next Sunday 7pm for week start
  week_start := DATE_TRUNC('week', now_time) + INTERVAL '7 days' + INTERVAL '19 hours';
  IF EXTRACT(DOW FROM now_time) = 0 AND EXTRACT(HOUR FROM now_time) >= 19 THEN
    -- If it's Sunday 7pm or later, use this Sunday
    week_start := DATE_TRUNC('week', now_time) + INTERVAL '19 hours';
  END IF;
  
  -- Week ends next Sunday at 6:59pm
  week_end := week_start + INTERVAL '7 days' - INTERVAL '1 minute';
  
  -- Create new week
  INSERT INTO weeks (start_at, end_at)
  VALUES (week_start, week_end)
  RETURNING weeks.id, weeks.start_at, weeks.end_at, weeks.created_at
  INTO current_week_record.id, current_week_record.start_at, current_week_record.end_at, current_week_record.created_at;
  
  RETURN QUERY SELECT 
    current_week_record.id,
    current_week_record.start_at,
    current_week_record.end_at,
    current_week_record.created_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Storage setup (for audio files)
-- ============================================

-- Note: Storage buckets need to be created via Supabase Dashboard
-- Go to Storage > Create bucket > Name: "reflection-audio" > Public: false

-- ============================================
-- Verification
-- ============================================

-- Verify circle_members constraint
SELECT 
    constraint_name, 
    constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'circle_members' 
    AND constraint_type = 'UNIQUE';

-- Should show: circle_members_user_id_circle_id_key



