# How to Verify Supabase Cron Jobs

## Quick Check (Recommended)

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/wildgnkpmalxvadlmjbj/database/cron
2. **Check if cron jobs exist** - You should see jobs for Sunday and Monday reminders

## Via SQL Editor

1. **Open Supabase SQL Editor**: https://supabase.com/dashboard/project/wildgnkpmalxvadlmjbj/sql/new
2. **Copy and paste** the contents of `scripts/check-cron-jobs.sql`
3. **Run the query** - It will show:
   - Whether pg_cron extension is enabled
   - All existing cron jobs
   - Specifically Sunday/Monday reminder jobs

## Expected Configuration

For **7pm PST** reminders:

- **Sunday reminder**: 
  - Schedule: `0 3 * * 1` (Monday 3am UTC = Sunday 7pm PST)
  - Function: `sunday-reminder`

- **Monday reminder**: 
  - Schedule: `0 3 * * 2` (Tuesday 3am UTC = Monday 7pm PST)  
  - Function: `monday-reminder`

## If Jobs Don't Exist

Cron jobs must be configured in the Supabase Dashboard (they can't be set up via CLI/SQL directly). See `CHUNK_10_TESTING.md` for setup instructions.

## Timezone Note

- PST = UTC-8 (Pacific Standard Time)
- PDT = UTC-7 (Pacific Daylight Time, during summer)
- All cron schedules in Supabase use UTC





