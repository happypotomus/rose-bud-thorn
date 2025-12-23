-- Diagnostic script to check why Sunday reminder didn't trigger
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. Check if pg_cron extension is enabled
-- ============================================================
SELECT 
  extname,
  extversion,
  CASE 
    WHEN extname = 'pg_cron' THEN '✅ pg_cron is enabled'
    WHEN extname = 'pg_net' THEN '✅ pg_net is enabled'
    ELSE '❌ Extension not found'
  END as status
FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net')
ORDER BY extname;

-- If no rows returned, extensions are NOT enabled
-- Fix: Run scripts/enable-pg-cron.sql or enable via Dashboard

-- ============================================================
-- 2. Check if cron jobs exist
-- ============================================================
-- This will only work if pg_cron is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is enabled. Checking cron jobs...';
  ELSE
    RAISE WARNING '❌ pg_cron is NOT enabled. Cron jobs cannot run.';
    RAISE WARNING 'Fix: Enable pg_cron extension first.';
    RETURN;
  END IF;
END $$;

-- List all cron jobs
SELECT 
  jobid,
  schedule,
  jobname,
  active,
  CASE 
    WHEN active THEN '✅ Active'
    ELSE '❌ Inactive (disabled)'
  END as status,
  CASE 
    WHEN LENGTH(command) > 100 THEN LEFT(command, 100) || '...'
    ELSE command
  END as command_preview
FROM cron.job
ORDER BY jobid;

-- ============================================================
-- 3. Check specifically for Sunday reminder job
-- ============================================================
SELECT 
  jobid,
  schedule,
  jobname,
  active,
  command,
  CASE 
    WHEN jobname LIKE '%sunday%' AND active THEN '✅ Sunday reminder is scheduled and active'
    WHEN jobname LIKE '%sunday%' AND NOT active THEN '❌ Sunday reminder exists but is INACTIVE'
    ELSE '❌ Sunday reminder job NOT FOUND'
  END as status
FROM cron.job
WHERE jobname LIKE '%sunday%' OR command LIKE '%sunday-reminder%';

-- ============================================================
-- 4. Timezone Analysis
-- ============================================================
-- Current time in UTC and PST/PDT
SELECT 
  NOW() as current_utc_time,
  NOW() AT TIME ZONE 'America/Los_Angeles' as current_pacific_time,
  EXTRACT(TIMEZONE_HOUR FROM NOW() AT TIME ZONE 'America/Los_Angeles') as pacific_offset_hours,
  CASE 
    WHEN EXTRACT(TIMEZONE_HOUR FROM NOW() AT TIME ZONE 'America/Los_Angeles') = -8 THEN 'PST (UTC-8)'
    WHEN EXTRACT(TIMEZONE_HOUR FROM NOW() AT TIME ZONE 'America/Los_Angeles') = -7 THEN 'PDT (UTC-7)'
    ELSE 'Unknown'
  END as pacific_timezone;

-- Expected cron schedule analysis
SELECT 
  'Sunday 7pm PST' as reminder_time,
  'Monday 3am UTC' as expected_cron_time,
  '0 3 * * 1' as expected_schedule,
  CASE 
    WHEN EXTRACT(TIMEZONE_HOUR FROM NOW() AT TIME ZONE 'America/Los_Angeles') = -7 THEN 
      '⚠️ WARNING: Currently PDT (UTC-7). Sunday 7pm PDT = Monday 2am UTC, not 3am UTC!'
    ELSE 
      '✅ Currently PST (UTC-8). Schedule should be correct.'
  END as timezone_warning;

-- ============================================================
-- 5. Check if Edge Function exists and is accessible
-- ============================================================
-- Note: This can't be checked via SQL, but you can verify:
-- 1. Go to Supabase Dashboard → Edge Functions
-- 2. Check if "sunday-reminder" function exists
-- 3. Check if it has all required secrets set:
--    - SUPABASE_URL
--    - SUPABASE_SERVICE_ROLE_KEY
--    - TWILIO_ACCOUNT_SID
--    - TWILIO_AUTH_TOKEN
--    - TWILIO_PHONE_NUMBER

-- ============================================================
-- 6. Check recent cron job execution history
-- ============================================================
-- This shows if the job has run recently
SELECT 
  jobid,
  jobname,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobname LIKE '%sunday%'
ORDER BY start_time DESC
LIMIT 10;

-- If no rows, the job has never run
-- If status = 'failed', check return_message for errors

-- ============================================================
-- SUMMARY OF COMMON ISSUES:
-- ============================================================
-- 
-- Issue 1: pg_cron not enabled
--   Fix: Enable via Dashboard → Database → Extensions → pg_cron
--   OR run: CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- Issue 2: Cron jobs not created
--   Fix: Run scripts/create-reminder-cron-jobs.sql
--   Note: Make sure to replace YOUR_SERVICE_ROLE_KEY with actual key
--
-- Issue 3: Timezone mismatch (PST vs PDT)
--   Current schedule: '0 3 * * 1' = Monday 3am UTC = Sunday 7pm PST
--   If currently PDT: Sunday 7pm PDT = Monday 2am UTC
--   Fix: Update schedule to '0 2 * * 1' during PDT months
--   OR use a timezone-aware approach
--
-- Issue 4: Job is inactive
--   Fix: Activate the job: UPDATE cron.job SET active = true WHERE jobname = 'sunday-reminder-7pm-pst';
--
-- Issue 5: Edge Function secrets not set
--   Fix: Go to Dashboard → Edge Functions → sunday-reminder → Settings → Secrets
--   Set all required secrets
--
-- Issue 6: Edge Function not deployed
--   Fix: Deploy the function: supabase functions deploy sunday-reminder
