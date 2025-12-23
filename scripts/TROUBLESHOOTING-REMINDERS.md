# Troubleshooting: Sunday Reminder Didn't Trigger

## Quick Diagnosis

Run this SQL in Supabase Dashboard → SQL Editor:
```sql
-- Copy and paste: scripts/diagnose-reminder-issue.sql
```

## Most Common Issues

### 1. ⚠️ **Timezone Mismatch (MOST LIKELY)**

**Problem**: Cron is scheduled for PST (UTC-8), but you're currently in PDT (UTC-7).

- **PST**: Sunday 7pm PST = Monday 3am UTC → Schedule: `0 3 * * 1`
- **PDT**: Sunday 7pm PDT = Monday 2am UTC → Schedule: `0 2 * * 1`

**Check current timezone**:
```sql
SELECT 
  NOW() AT TIME ZONE 'America/Los_Angeles' as pacific_time,
  EXTRACT(TIMEZONE_HOUR FROM NOW() AT TIME ZONE 'America/Los_Angeles') as offset;
```

**Fix**: Run `scripts/fix-sunday-reminder-timezone.sql`

---

### 2. ❌ **Cron Jobs Not Created**

**Check**: 
```sql
SELECT * FROM cron.job WHERE jobname LIKE '%sunday%';
```

If no rows returned, jobs don't exist.

**Fix**: 
1. Make sure `pg_cron` extension is enabled (see #3)
2. Run `scripts/create-reminder-cron-jobs.sql`
3. **Important**: Replace `YOUR_SERVICE_ROLE_KEY` with your actual service role key

---

### 3. ❌ **pg_cron Extension Not Enabled**

**Check**:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

If no rows, extension is not enabled.

**Fix**:
1. Go to Supabase Dashboard → Database → Extensions
2. Find "pg_cron" and click "Enable"
3. Also enable "pg_net" (needed for HTTP calls)
4. OR run: `scripts/enable-pg-cron.sql`

**Note**: Some Supabase plans require Pro or higher for pg_cron.

---

### 4. ❌ **Cron Job is Inactive**

**Check**:
```sql
SELECT jobname, active FROM cron.job WHERE jobname LIKE '%sunday%';
```

If `active = false`, the job won't run.

**Fix**:
```sql
UPDATE cron.job SET active = true WHERE jobname = 'sunday-reminder-7pm-pst';
```

---

### 5. ❌ **Edge Function Secrets Not Set**

**Check**: 
1. Go to Supabase Dashboard → Edge Functions → `sunday-reminder`
2. Click "Settings" → "Secrets"
3. Verify these are set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

**Fix**: Set missing secrets via Dashboard or CLI:
```bash
supabase secrets set SUPABASE_URL="https://wildgnkpmalxvadlmjbj.supabase.co" --project-ref wildgnkpmalxvadlmjbj
# ... set other secrets
```

---

### 6. ❌ **Edge Function Not Deployed**

**Check**: 
1. Go to Supabase Dashboard → Edge Functions
2. Verify `sunday-reminder` function exists and is deployed

**Fix**: Deploy the function:
```bash
supabase functions deploy sunday-reminder --project-ref wildgnkpmalxvadlmjbj
```

---

### 7. ❌ **Function Execution Failed**

**Check execution history**:
```sql
SELECT 
  jobname,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobname LIKE '%sunday%'
ORDER BY start_time DESC
LIMIT 5;
```

Look for `status = 'failed'` and check `return_message` for errors.

**Common errors**:
- Missing environment variables
- Twilio API errors
- Database connection issues

---

## Step-by-Step Fix Process

1. **Run diagnostic script**:
   ```sql
   -- Copy: scripts/diagnose-reminder-issue.sql
   ```

2. **Fix timezone issue** (most likely):
   ```sql
   -- Copy: scripts/fix-sunday-reminder-timezone.sql
   ```

3. **Verify cron job is active**:
   ```sql
   SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%sunday%';
   ```

4. **Test manually** (trigger the function directly):
   ```bash
   curl -X POST https://rose-bud-thorn.vercel.app/api/trigger-sunday-reminder \
     -H "Content-Type: application/json"
   ```
   
   OR use the Supabase Dashboard → Edge Functions → `sunday-reminder` → "Invoke"

5. **Check execution logs**:
   - Supabase Dashboard → Edge Functions → `sunday-reminder` → "Logs"
   - Look for errors or missing environment variables

---

## Manual Test

To test if everything works, manually trigger the reminder:

**Via API** (if you have the endpoint):
```bash
curl -X POST https://rose-bud-thorn.vercel.app/api/trigger-sunday-reminder
```

**Via Supabase Dashboard**:
1. Go to Edge Functions → `sunday-reminder`
2. Click "Invoke" button
3. Check the response and logs

**Via SQL** (if helper function exists):
```sql
SELECT call_sunday_reminder();
```

---

## Prevention: Better Timezone Handling

For future, consider:
1. Using a timezone-aware cron library
2. Setting up two cron jobs (one for PST, one for PDT)
3. Using a scheduled task service that handles DST automatically
4. Running the job at a time that works for both (e.g., 2:30am UTC)

---

## Need More Help?

1. Check Supabase Dashboard → Database → Cron for job status
2. Check Edge Functions → Logs for execution errors
3. Verify all environment variables are set
4. Test the function manually to isolate the issue
