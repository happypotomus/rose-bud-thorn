# Chunk 10 Testing Guide - Reminder SMS Edge Functions

This guide explains how to test the Sunday and Monday reminder Edge Functions locally before setting up real cron jobs.

## Prerequisites

1. **Supabase CLI installed** (for local Edge Function testing)
   ```bash
   npm install -g supabase
   ```

2. **Environment variables set in Supabase project:**
   - Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Add the following secrets:
     - `SUPABASE_URL` (your project URL)
     - `SUPABASE_SERVICE_ROLE_KEY` (from Project Settings → API)
     - `TWILIO_ACCOUNT_SID`
     - `TWILIO_AUTH_TOKEN`
     - `TWILIO_PHONE_NUMBER`

3. **Local `.env.local` should have:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...  # For API routes
   ```

## Testing Methods

### Method 1: Deploy Edge Functions and Use API Routes (Recommended)

1. **Deploy Edge Functions to Supabase:**
   ```bash
   # Login to Supabase CLI
   supabase login
   
   # Link your project
   supabase link --project-ref your-project-ref
   
   # Deploy functions
   supabase functions deploy sunday-reminder
   supabase functions deploy monday-reminder
   ```

2. **Set Edge Function secrets in Supabase Dashboard:**
   - Project Settings → Edge Functions → Secrets
   - Add all required secrets (see Prerequisites)

3. **Test via Next.js API routes:**
   ```bash
   # Start Next.js dev server
   npm run dev
   
   # In another terminal, trigger Sunday reminder
   curl -X POST http://localhost:3000/api/trigger-sunday-reminder
   
   # Trigger Monday reminder
   curl -X POST http://localhost:3000/api/trigger-monday-reminder
   ```

### Method 2: Test Edge Functions Locally with Supabase CLI

1. **Start local Supabase (if using local development):**
   ```bash
   supabase start
   ```

2. **Serve Edge Functions locally:**
   ```bash
   supabase functions serve sunday-reminder --env-file .env.local
   supabase functions serve monday-reminder --env-file .env.local
   ```

3. **Call functions directly:**
   ```bash
   # Get your anon key from Supabase Dashboard
   curl -X POST http://localhost:54321/functions/v1/sunday-reminder \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json"
   ```

### Method 3: Direct HTTP Call to Deployed Functions

If functions are deployed, you can call them directly:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/sunday-reminder \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Expected Behavior

### Sunday Reminder Function

1. Gets or creates current week
2. Fetches all circles
3. For each circle:
   - Gets all members
   - Gets their profiles (phone, first_name)
   - Sends personalized SMS: "Hey {firstName}, it's time for your weekly Rose–Bud–Thorn reflection."
   - Logs to `notification_logs` with type `first_reminder`

**Expected Response:**
```json
{
  "success": true,
  "weekId": "uuid",
  "totalSent": 2,
  "totalErrors": 0,
  "results": [
    {
      "circleId": "uuid",
      "circleName": "Circle Name",
      "userId": "uuid",
      "firstName": "John",
      "phone": "+1234567890",
      "messageSid": "SM...",
      "logged": true
    }
  ]
}
```

### Monday Reminder Function

1. Gets current week
2. Fetches all circles
3. For each circle:
   - Gets all members
   - Finds members who haven't submitted (no reflection with `submitted_at` for current week)
   - Sends reminder SMS: "Gentle reminder to complete your weekly reflection."
   - Logs to `notification_logs` with type `second_reminder`

**Expected Response:**
```json
{
  "success": true,
  "weekId": "uuid",
  "totalSent": 1,
  "totalErrors": 0,
  "results": [
    {
      "circleId": "uuid",
      "circleName": "Circle Name",
      "userId": "uuid",
      "firstName": "Jane",
      "phone": "+1234567890",
      "messageSid": "SM...",
      "logged": true
    }
  ]
}
```

## Verification Steps

### 1. Check SMS Delivery

- Verify that SMS messages were received on verified Twilio phone numbers
- Check Twilio Console → Messaging → Logs for delivery status

### 2. Check Database Logs

Run in Supabase SQL Editor:

```sql
-- Check notification logs
SELECT 
  nl.*,
  p.first_name,
  p.phone,
  c.name as circle_name
FROM notification_logs nl
JOIN profiles p ON nl.user_id = p.id
JOIN circles c ON nl.circle_id = c.id
ORDER BY nl.sent_at DESC
LIMIT 20;
```

### 3. Verify Week Creation

```sql
-- Check current week
SELECT * FROM weeks 
WHERE NOW() >= start_at AND NOW() < end_at;
```

### 4. Test Non-Submitter Detection (Monday Reminder)

1. Create a test scenario:
   - Ensure you have a circle with multiple members
   - Have one member submit a reflection for current week
   - Leave another member without a submission

2. Trigger Monday reminder:
   ```bash
   curl -X POST http://localhost:3000/api/trigger-monday-reminder
   ```

3. Verify:
   - Only the non-submitter receives the SMS
   - Notification log shows `second_reminder` type
   - Submitter does NOT receive a reminder

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Ensure Edge Function secrets are set in Supabase Dashboard
- For local testing, ensure `.env.local` has all required variables

### Error: "Missing Twilio environment variables"
- Check that Twilio secrets are set in Edge Function secrets
- Verify Twilio credentials are correct

### Error: "Failed to get current week"
- Check that `get_or_create_current_week()` RPC function exists
- Verify RLS policies allow the service role to execute it

### SMS Not Received
- Verify phone numbers are verified in Twilio Console (trial accounts only)
- Check Twilio account balance/limits
- Review Twilio Console logs for delivery errors

### No Circles Found
- Ensure you have at least one circle in the database
- Check that circles have members

## Setting Up Real Cron Jobs (Future)

Once testing is complete, you can set up real cron jobs in Supabase:

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create cron job for Sunday 7pm:
   - Schedule: `0 19 * * 0` (Sunday at 7pm)
   - Function: `sunday-reminder`
3. Create cron job for Monday 7pm:
   - Schedule: `0 19 * * 1` (Monday at 7pm)
   - Function: `monday-reminder`

## Notes

- Edge Functions run in Deno, not Node.js
- Twilio SDK is not available in Deno, so we use Twilio REST API directly
- Service role key is required to bypass RLS for system operations
- All notifications are logged to `notification_logs` for audit trail


