-- Fix: Enable pg_net extension (required for HTTP calls in cron jobs)
-- This is why your reminders are failing!

-- ============================================================
-- Step 1: Check if pg_net is enabled
-- ============================================================
SELECT 
  extname,
  extversion,
  CASE 
    WHEN extname = 'pg_net' THEN '✅ pg_net is enabled'
    ELSE '❌ pg_net is NOT enabled'
  END as status
FROM pg_extension 
WHERE extname = 'pg_net';

-- ============================================================
-- Step 2: Enable pg_net extension
-- ============================================================
-- If the above query returns no rows, run this:
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Note: If you get a permission error, enable it via Dashboard:
-- Dashboard → Database → Extensions → Find "pg_net" → Click "Enable"

-- ============================================================
-- Step 3: Verify it's enabled
-- ============================================================
SELECT 
  extname,
  extversion,
  '✅ pg_net is now enabled' as status
FROM pg_extension 
WHERE extname = 'pg_net';

-- ============================================================
-- Step 4: Test the helper function
-- ============================================================
-- After enabling pg_net, test if the function works:
-- SELECT call_sunday_reminder();

-- ============================================================
-- Step 5: Recreate the helper functions (if needed)
-- ============================================================
-- If the functions still don't work, recreate them:

-- Function to call Sunday reminder Edge Function
CREATE OR REPLACE FUNCTION call_sunday_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbGRnbmtwbWFseHZhZGxtamJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY5ODYwMSwiZXhwIjoyMDc5Mjc0NjAxfQ.3HYbb3Bi911pcSq93FlLQYfjTEB-OL9pwd6zQHJaL_8';
  project_url TEXT := 'https://wildgnkpmalxvadlmjbj.supabase.co';
BEGIN
  PERFORM net.http_post(
    url := project_url || '/functions/v1/sunday-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Function to call Monday reminder Edge Function
CREATE OR REPLACE FUNCTION call_monday_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbGRnbmtwbWFseHZhZGxtamJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY5ODYwMSwiZXhwIjoyMDc5Mjc0NjAxfQ.3HYbb3Bi911pcSq93FlLQYfjTEB-OL9pwd6zQHJaL_8';
  project_url TEXT := 'https://wildgnkpmalxvadlmjbj.supabase.co';
BEGIN
  PERFORM net.http_post(
    url := project_url || '/functions/v1/monday-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- ============================================================
-- Step 6: Test the function manually
-- ============================================================
-- After enabling pg_net, test if it works:
-- SELECT call_sunday_reminder();

-- If this works, your cron jobs should work on the next scheduled run!
