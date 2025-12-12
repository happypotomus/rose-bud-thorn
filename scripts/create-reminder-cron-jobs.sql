-- Create cron jobs for Sunday and Monday reminder SMS
-- Run this in Supabase SQL Editor after pg_cron and pg_net are enabled
--
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY below with your actual service_role key
-- Find it in: Dashboard → Project Settings → API → service_role (secret) key

-- Step 1: Verify pg_net is enabled (needed for HTTP calls)
SELECT 
  extname,
  extversion,
  CASE 
    WHEN extname = 'pg_net' THEN '✅ pg_net is enabled'
    ELSE '❌ pg_net is NOT enabled - run: CREATE EXTENSION IF NOT EXISTS pg_net;'
  END as status
FROM pg_extension 
WHERE extname = 'pg_net';

-- If pg_net is not enabled, uncomment and run this line:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create helper functions that call the Edge Functions
-- ⚠️ IMPORTANT: Replace 'YOUR_SERVICE_ROLE_KEY' with your actual key below!

-- Function to call Sunday reminder Edge Function
CREATE OR REPLACE FUNCTION call_sunday_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_key TEXT := 'YOUR_SERVICE_ROLE_KEY';  -- ⚠️ REPLACE THIS WITH YOUR ACTUAL KEY!
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
  service_key TEXT := 'sb_secret_FE23zAjUG6zRiF9--6auZA_a8GnyyTE';  -- ⚠️ REPLACE THIS WITH YOUR ACTUAL KEY!
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

-- Step 3: Create the cron jobs
-- Sunday 7pm PST = Monday 3am UTC
-- Schedule format: minute hour day-of-month month day-of-week
-- day-of-week: 0=Sunday, 1=Monday, 2=Tuesday, etc.

SELECT cron.schedule(
  'sunday-reminder-7pm-pst',
  '0 3 * * 1',  -- Every Monday at 3am UTC (Sunday 7pm PST)
  'SELECT call_sunday_reminder();'
);

-- Monday 7pm PST = Tuesday 3am UTC
SELECT cron.schedule(
  'monday-reminder-7pm-pst',
  '0 3 * * 2',  -- Every Tuesday at 3am UTC (Monday 7pm PST)
  'SELECT call_monday_reminder();'
);

-- Step 4: Verify the jobs were created
SELECT 
  jobid,
  schedule,
  jobname,
  active,
  CASE 
    WHEN jobname LIKE '%sunday%' THEN 'Sunday 7pm PST reminder'
    WHEN jobname LIKE '%monday%' THEN 'Monday 7pm PST reminder'
    ELSE 'Other job'
  END as description
FROM cron.job
WHERE jobname LIKE '%reminder%'
ORDER BY jobid;

-- Expected output: 2 rows showing both scheduled jobs

-- ============================================================
-- To remove jobs later (if needed):
-- SELECT cron.unschedule('sunday-reminder-7pm-pst');
-- SELECT cron.unschedule('monday-reminder-7pm-pst');
-- ============================================================
