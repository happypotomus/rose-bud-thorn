-- Script to check if cron jobs are configured for Sunday and Monday reminders
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================================
-- 1. Check if pg_cron extension is enabled
-- ============================================================
SELECT 
  extname,
  extversion,
  CASE 
    WHEN extname = 'pg_cron' THEN '✅ pg_cron is enabled'
    ELSE '❌ pg_cron is NOT enabled'
  END as status
FROM pg_extension 
WHERE extname = 'pg_cron';

-- ============================================================
-- 2. Try to enable pg_cron if it doesn't exist
-- ============================================================
-- If the above query returns no rows, run this:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 3. List ALL cron jobs (only works if pg_cron is enabled)
-- ============================================================
-- This query will only work if pg_cron extension exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- pg_cron is enabled, so we can query cron.job
    RAISE NOTICE 'pg_cron is enabled. Listing cron jobs...';
  ELSE
    RAISE WARNING 'pg_cron extension is NOT enabled. Cannot list cron jobs.';
    RAISE WARNING 'To enable it, run: CREATE EXTENSION IF NOT EXISTS pg_cron;';
  END IF;
END $$;

-- ============================================================
-- 3. List ALL cron jobs (only if pg_cron is enabled)
-- ============================================================
-- SKIP THIS SECTION IF pg_cron IS NOT ENABLED
-- Run the queries below only after enabling pg_cron

-- Uncomment the queries below if pg_cron is enabled:

/*
SELECT 
  jobid,
  schedule,
  jobname,
  active,
  CASE 
    WHEN LENGTH(command) > 100 THEN LEFT(command, 100) || '...'
    ELSE command
  END as command_preview
FROM cron.job
ORDER BY jobid;

-- ============================================================
-- 4. Check specifically for Sunday and Monday reminder jobs
-- ============================================================
SELECT 
  jobid,
  schedule,
  jobname,
  active,
  CASE 
    WHEN LENGTH(command) > 150 THEN LEFT(command, 150) || '...'
    ELSE command
  END as full_command
FROM cron.job
WHERE command LIKE '%sunday-reminder%' 
   OR command LIKE '%monday-reminder%'
   OR jobname LIKE '%sunday%'
   OR jobname LIKE '%monday%'
   OR schedule LIKE '% * * 0%'  -- Sunday (day 0)
   OR schedule LIKE '% * * 1%';  -- Monday (day 1)
*/

-- ============================================================
-- Expected Configuration (for 7pm PST):
-- ============================================================
-- PST is UTC-8 (Pacific Standard Time)
-- Sunday 7pm PST = Monday 3am UTC
-- Monday 7pm PST = Tuesday 3am UTC
--
-- Sunday reminder job should have:
--   - Schedule: 0 3 * * 1  (Monday 3am UTC = Sunday 7pm PST)
--   - Command: Calls the sunday-reminder Edge Function via HTTP
--
-- Monday reminder job should have:
--   - Schedule: 0 3 * * 2  (Tuesday 3am UTC = Monday 7pm PST)
--   - Command: Calls the monday-reminder Edge Function via HTTP
--
-- ============================================================
-- SETUP INSTRUCTIONS:
-- ============================================================
-- 
-- Step 1: Enable pg_cron extension
--   Run: scripts/enable-pg-cron.sql
--   OR go to: Dashboard → Database → Extensions → Enable "pg_cron"
-- 
-- Step 2: If pg_cron is enabled but no jobs exist, create them
--   You'll need to create cron jobs that call your Edge Functions
--   The Edge Functions exist at:
--     - /functions/v1/sunday-reminder
--     - /functions/v1/monday-reminder
-- 
-- Step 3: Cron jobs need to be created via SQL (see setup-cron-jobs-simple.sql)
--   Note: This requires the pg_net extension to make HTTP calls
-- 
-- ============================================================
