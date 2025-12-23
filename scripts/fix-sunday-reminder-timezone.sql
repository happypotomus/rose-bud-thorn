-- Fix Sunday reminder cron job for timezone (PST vs PDT)
-- 
-- PROBLEM: Cron is set for PST (UTC-8), but we're currently in PDT (UTC-7)
-- Sunday 7pm PDT = Monday 2am UTC (not 3am UTC)
--
-- SOLUTION: Update the cron schedule to account for daylight saving time
-- OR use a schedule that works for both

-- ============================================================
-- Option 1: Update to PDT schedule (2am UTC)
-- ============================================================
-- Use this if you're currently in daylight saving time (spring/summer)
-- This sets it to Monday 2am UTC = Sunday 7pm PDT

UPDATE cron.job
SET schedule = '0 2 * * 1'  -- Monday 2am UTC = Sunday 7pm PDT
WHERE jobname = 'sunday-reminder-7pm-pst';

-- ============================================================
-- Option 2: Use a schedule that covers both (2-3am UTC window)
-- ============================================================
-- This is less precise but works year-round
-- Note: Cron doesn't support ranges easily, so this is a compromise

-- For now, use 2am UTC (works for PDT)
-- You'll need to manually change to 3am UTC when DST ends

-- ============================================================
-- Option 3: Check current timezone and set accordingly
-- ============================================================
-- This script checks if we're in PDT and updates the schedule

DO $$
DECLARE
  current_offset INTEGER;
  new_schedule TEXT;
BEGIN
  -- Get current Pacific timezone offset
  SELECT EXTRACT(TIMEZONE_HOUR FROM NOW() AT TIME ZONE 'America/Los_Angeles')::INTEGER
  INTO current_offset;
  
  -- Determine schedule based on offset
  IF current_offset = -7 THEN
    -- PDT (UTC-7): Sunday 7pm PDT = Monday 2am UTC
    new_schedule := '0 2 * * 1';
    RAISE NOTICE 'Currently PDT (UTC-7). Setting schedule to 2am UTC';
  ELSIF current_offset = -8 THEN
    -- PST (UTC-8): Sunday 7pm PST = Monday 3am UTC
    new_schedule := '0 3 * * 1';
    RAISE NOTICE 'Currently PST (UTC-8). Setting schedule to 3am UTC';
  ELSE
    RAISE WARNING 'Unexpected timezone offset: %', current_offset;
    new_schedule := '0 2 * * 1';  -- Default to 2am (PDT)
  END IF;
  
  -- Update the cron job
  UPDATE cron.job
  SET schedule = new_schedule
  WHERE jobname = 'sunday-reminder-7pm-pst';
  
  RAISE NOTICE 'Updated Sunday reminder schedule to: %', new_schedule;
END $$;

-- ============================================================
-- Verify the update
-- ============================================================
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN schedule = '0 2 * * 1' THEN '✅ Set for PDT (Sunday 7pm PDT = Monday 2am UTC)'
    WHEN schedule = '0 3 * * 1' THEN '✅ Set for PST (Sunday 7pm PST = Monday 3am UTC)'
    ELSE '⚠️ Unexpected schedule'
  END as status
FROM cron.job
WHERE jobname = 'sunday-reminder-7pm-pst';

-- ============================================================
-- Also ensure the job is active
-- ============================================================
UPDATE cron.job
SET active = true
WHERE jobname = 'sunday-reminder-7pm-pst';

-- Verify it's active
SELECT 
  jobname,
  active,
  CASE 
    WHEN active THEN '✅ Job is active and will run'
    ELSE '❌ Job is inactive and will NOT run'
  END as status
FROM cron.job
WHERE jobname = 'sunday-reminder-7pm-pst';
