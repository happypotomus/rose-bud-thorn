# Chunk 10 Setup Guide - Quick Start

This guide will help you deploy the Edge Functions and set up everything needed for Chunk 10.

## Prerequisites Check

✅ **Supabase CLI installed** - You have v2.23.4 (consider updating to v2.58.5)  
❌ **Docker Desktop** - Not currently running (required for function deployment)

## Quick Setup Steps

### Step 1: Start Docker Desktop

1. Open Docker Desktop application
2. Wait for it to fully start (whale icon in menu bar should be steady)

### Step 2: Deploy Edge Functions

Once Docker is running, run:

```bash
./scripts/deploy-functions.sh
```

Or manually:

```bash
supabase functions deploy sunday-reminder --project-ref wildgnkpmalxvadlmjbj --no-verify-jwt
supabase functions deploy monday-reminder --project-ref wildgnkpmalxvadlmjbj --no-verify-jwt
```

### Step 3: Set Edge Function Secrets

**Option A: Via Script (Recommended)**

Make sure your `.env.local` has:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (get from Supabase Dashboard → Project Settings → API)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

Then run:

```bash
./scripts/set-function-secrets.sh
```

**Option B: Via Supabase Dashboard**

1. Go to: https://supabase.com/dashboard/project/wildgnkpmalxvadlmjbj/settings/functions
2. Click "Secrets" tab
3. Add each secret:
   - `SUPABASE_URL` = Your project URL (from `.env.local` → `NEXT_PUBLIC_SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY` = Service role key (from Project Settings → API)
   - `TWILIO_ACCOUNT_SID` = Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN` = Your Twilio Auth Token
   - `TWILIO_PHONE_NUMBER` = Your Twilio phone number (E.164 format, e.g., +1234567890)

**Option C: Via CLI (Manual)**

```bash
supabase secrets set SUPABASE_URL="your-url" --project-ref wildgnkpmalxvadlmjbj
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-key" --project-ref wildgnkpmalxvadlmjbj
supabase secrets set TWILIO_ACCOUNT_SID="your-sid" --project-ref wildgnkpmalxvadlmjbj
supabase secrets set TWILIO_AUTH_TOKEN="your-token" --project-ref wildgnkpmalxvadlmjbj
supabase secrets set TWILIO_PHONE_NUMBER="your-number" --project-ref wildgnkpmalxvadlmjbj
```

### Step 4: Verify Secrets

```bash
supabase secrets list --project-ref wildgnkpmalxvadlmjbj
```

You should see all 5 secrets listed.

### Step 5: Test the Functions

1. Start your Next.js dev server:
   ```bash
   npm run dev
   ```

2. In another terminal, test Sunday reminder:
   ```bash
   curl -X POST http://localhost:3000/api/trigger-sunday-reminder
   ```

3. Test Monday reminder:
   ```bash
   curl -X POST http://localhost:3000/api/trigger-monday-reminder
   ```

## What Gets Deployed

- **Sunday Reminder Function** (`sunday-reminder`)
  - Gets all circles and members
  - Sends personalized first reminder SMS
  - Logs to `notification_logs`

- **Monday Reminder Function** (`monday-reminder`)
  - Finds non-submitters for current week
  - Sends second reminder SMS
  - Logs to `notification_logs`

## Troubleshooting

### "Docker is not running"
- Start Docker Desktop and wait for it to fully initialize
- Verify with: `docker info`

### "Missing Supabase environment variables"
- Ensure `.env.local` exists and has all required variables
- For Edge Functions, secrets must be set in Supabase Dashboard or via CLI

### "Missing Twilio environment variables"
- Verify Twilio credentials are correct
- Ensure phone numbers are verified in Twilio Console (for trial accounts)

### Functions deployed but not working
- Check function logs in Supabase Dashboard → Edge Functions → Logs
- Verify all secrets are set correctly
- Test function directly via Supabase Dashboard → Edge Functions → Invoke

## Next Steps After Setup

Once everything is working:

1. **Test with real data**: Ensure you have circles with members in your database
2. **Verify SMS delivery**: Check that SMS messages are received
3. **Check notification logs**: Query `notification_logs` table to verify logging
4. **Set up cron jobs** (optional, for production):
   - Sunday 7pm: `0 19 * * 0`
   - Monday 7pm: `0 19 * * 1`

See `CHUNK_10_TESTING.md` for detailed testing procedures.

