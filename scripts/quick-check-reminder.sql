-- QUICK CHECK: Why didn't Sunday reminder fire?
-- Run this first - it checks the most common issues

-- ============================================================
-- 1. Does the cron job exist?
-- ============================================================
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN jobname IS NULL THEN '❌ NO JOB FOUND - You need to create it!'
    WHEN NOT active THEN '❌ Job exists but is INACTIVE - Enable it!'
    WHEN active THEN '✅ Job exists and is active'
    ELSE '⚠️ Unknown status'
  END as status
FROM cron.job
WHERE jobname LIKE '%sunday%' OR command LIKE '%sunday-reminder%';

-- If no rows: The job doesn't exist. Run: scripts/create-reminder-cron-jobs.sql

-- ============================================================
-- 2. Is pg_cron enabled?
-- ============================================================
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ pg_cron is enabled'
    ELSE '❌ pg_cron is NOT enabled - cron jobs cannot run!'
  END as pg_cron_status
FROM pg_extension 
WHERE extname = 'pg_cron';

-- If not enabled: Go to Dashboard → Database → Extensions → Enable "pg_cron"

-- ============================================================
-- 3. What's the schedule?
-- ============================================================
SELECT 
  jobname,
  schedule,
  CASE 
    WHEN schedule = '0 3 * * 1' THEN '✅ Correct for PST (Sunday 7pm PST = Monday 3am UTC)'
    WHEN schedule = '0 2 * * 1' THEN '✅ Correct for PDT (Sunday 7pm PDT = Monday 2am UTC)'
    ELSE '⚠️ Schedule: ' || schedule
  END as schedule_status
FROM cron.job
WHERE jobname LIKE '%sunday%';

-- ============================================================
-- 4. Check if job has run recently (simplified)
-- ============================================================
-- First, get the jobid from section 1, then check if it ran
-- Replace JOBID_HERE with the actual jobid from section 1

-- Example (uncomment and replace JOBID_HERE):
-- SELECT 
--   jobid,
--   status,
--   return_message,
--   start_time
-- FROM cron.job_run_details
-- WHERE jobid = JOBID_HERE  -- Replace with actual jobid
-- ORDER BY start_time DESC
-- LIMIT 5;

-- Or check all recent runs:
SELECT 
  jobid,
  status,
  LEFT(return_message, 100) as error_preview,
  start_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- Match the jobid with the jobid from section 1 to see if your Sunday reminder ran
