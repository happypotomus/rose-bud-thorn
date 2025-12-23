-- Check why Sunday reminder didn't fire at 7pm PST
-- Run this NOW to see what happened

-- ============================================================
-- QUICK CHECK: Does the job exist and is it active?
-- ============================================================
-- Run this section first to see the basics

-- ============================================================
-- 1. Verify the cron job exists and is active
-- ============================================================
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ Job is active'
    ELSE '❌ Job is INACTIVE - this is why it didn''t run!'
  END as status,
  command
FROM cron.job
WHERE jobname LIKE '%sunday%' OR command LIKE '%sunday-reminder%';

-- If no rows: Job doesn't exist - you need to create it
-- If active = false: Job exists but is disabled - enable it!

-- ============================================================
-- 2. Check if pg_cron extension is enabled
-- ============================================================
SELECT 
  extname,
  CASE 
    WHEN extname = 'pg_cron' THEN '✅ pg_cron is enabled'
    ELSE '❌ pg_cron is NOT enabled - cron jobs cannot run!'
  END as status
FROM pg_extension 
WHERE extname = 'pg_cron';

-- ============================================================
-- 3. Check cron job execution history
-- ============================================================
-- This shows if the job tried to run and what happened
-- Note: job_run_details doesn't have jobname, so we join with cron.job
SELECT 
  j.jobid,
  j.jobname,
  rd.runid,
  rd.status,
  rd.return_message,
  rd.start_time,
  rd.end_time,
  CASE 
    WHEN rd.status = 'succeeded' THEN '✅ Job ran successfully'
    WHEN rd.status = 'failed' THEN '❌ Job FAILED - check return_message'
    WHEN rd.status = 'running' THEN '⏳ Job is currently running'
    ELSE '⚠️ Unknown status'
  END as result
FROM cron.job_run_details rd
JOIN cron.job j ON rd.jobid = j.jobid
WHERE j.jobname LIKE '%sunday%' OR j.command LIKE '%sunday-reminder%'
ORDER BY rd.start_time DESC
LIMIT 10;

-- If no rows: Job has NEVER run (doesn't exist or not scheduled)
-- If status = 'failed': Check return_message for error details

-- Alternative: Check all recent job runs (if join doesn't work)
-- This shows all job runs, you can manually match jobid to find Sunday reminder
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
-- Match the jobid from above with the jobid from section 1 to see if Sunday reminder ran

-- ============================================================
-- 4. Verify the schedule is correct for PST
-- ============================================================
-- Current time check
SELECT 
  NOW() as current_utc_time,
  NOW() AT TIME ZONE 'America/Vancouver' as current_vancouver_time,
  'Sunday 7pm PST = Monday 3am UTC' as expected_schedule,
  '0 3 * * 1' as correct_cron_schedule;

-- Check if the job has the right schedule
SELECT 
  jobname,
  schedule,
  CASE 
    WHEN schedule = '0 3 * * 1' THEN '✅ Schedule is correct for PST (Sunday 7pm PST = Monday 3am UTC)'
    ELSE '❌ Schedule is WRONG: ' || schedule
  END as schedule_status
FROM cron.job
WHERE jobname LIKE '%sunday%';

-- ============================================================
-- 5. Check if Edge Function exists
-- ============================================================
-- Note: Can't check via SQL, but verify in Dashboard:
-- Supabase Dashboard → Edge Functions → Check if "sunday-reminder" exists

-- ============================================================
-- QUICK FIXES BASED ON RESULTS:
-- ============================================================

-- Fix 1: If job is inactive, activate it:
-- UPDATE cron.job SET active = true WHERE jobname = 'sunday-reminder-7pm-pst';

-- Fix 2: If job doesn't exist, create it (run create-reminder-cron-jobs.sql)

-- Fix 3: If pg_cron not enabled, enable it:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Fix 4: If job failed, check return_message for errors
-- Common errors:
--   - Missing Edge Function secrets
--   - Edge Function not deployed
--   - Network errors calling the function
