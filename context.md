# Rose–Bud–Thorn – Context Summary

This file summarizes the key decisions and implementation details so future work can resume without re-reading the entire spec or old chats.

---

## 1. Architecture & Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + React 19  
- **Styling**: TailwindCSS 3 + Shadcn UI  
- **Backend**: Supabase (Postgres, Auth, RLS, Storage, Cron, Edge Functions)  
- **Auth**: Supabase phone OTP via **Twilio Verify**  
- **SMS**:  
  - Twilio Verify for OTP  
  - Twilio SMS (with a dedicated phone number) for reminders / unlock notifications  
- **Deployment**:  
  - Local dev: `npm run dev` → `http://localhost:3000`  
  - Hosted: Vercel (project connected to GitHub repo `happypotomus/rose-bud-thorn`)  
- **Source of truth**: `rose_bud_thorn_full_spec.md` (do not diverge from this for v1 behavior)

---

## 2. Environment & Secrets

Local env is in `.env.local` (ignored by git). Important variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Twilio Verify (used via Supabase dashboard config, not directly in code)

# Twilio SMS (direct API usage for reminders/unlock)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

Notes:

- Twilio trial accounts can only send SMS to **verified numbers**. Both your phone and your wife’s phone must be verified in Twilio.  
- After changing `.env.local`, you **must restart** `npm run dev` for API routes to pick up new values.

---

## 3. Supabase Schema & RLS (High-Level)

Schema is defined via migrations under `supabase/migrations/`. Key tables:

- `profiles`  
  - `id` (PK, mirrors `auth.users.id`)  
  - `first_name` (TEXT, required)  
  - `phone` (TEXT, unique)  
- `circles`  
  - `id`, `name`, `invite_token` (TEXT, unique)  
- `circle_members`  
  - `id`, `circle_id`, `user_id`, `created_at`  
  - **Constraint**: `UNIQUE(user_id)` → **one circle per user**  
- `weeks`  
  - `id`, `start_at`, `end_at`, `created_at`  
- `reflections`  
  - `id`, `circle_id`, `week_id`, `user_id`  
  - `rose_text`, `bud_text`, `thorn_text`, `submitted_at`  
  - **Constraint**: `UNIQUE(user_id, circle_id, week_id)`  
- `notification_logs`  
  - For logging reminder/unlock SMS events

Important RLS policies (only the ones that matter for app behavior):

- `profiles`  
  - `"Users can view own profile"` – user sees only their own.  
  - `"Users can insert own profile"` – for OTP signup.  
  - **Added**: `"Users can view profiles in same circle"`  
    Allows a user to see profiles of other users in the same circle (needed for showing names in the reading flow).
- `circles`  
  - Policies adjusted so:
    - Unauthenticated users can read circles by `invite_token` (for invite landing page).  
    - Authenticated users (even not yet members) can read circle with given `invite_token` (invite+OTP flow).
- `circle_members`  
  - Users can see members of circles they belong to.  
  - Users can insert their own circle membership (used in invite callback).
- `weeks`  
  - Authenticated users can view.  
  - Insert policy added so RPC can create weeks.
- `reflections`  
  - Users can view reflections in circles they belong to.  
  - Users can insert/update their own reflection.

---

## 4. Week Logic (`currentWeek`)

- Implemented via Postgres **RPC**: `get_or_create_current_week()`  
  Multiple migrations refined this function to avoid type issues and naming conflicts (`current_time` → `now_time`).  
- Server util: `lib/supabase/week-server.ts`  
- Client util (for client components): `lib/supabase/week.ts` with `getCurrentWeekClient(supabase)`.

Behavior:

- For a given “now”, it finds a `weeks` row where `start_at <= now < end_at`.  
- If none exists, it **creates** the appropriate week (Sunday 7pm start, next Sunday 6:59pm end).  
- Dashboard & reflection wizard rely on this to know which `week_id` to use.

---

## 5. Core Flows Implemented

### 5.1 Invite + Auth Flow

Files:

- `app/invite/page.tsx` → Suspense wrapper  
- `app/invite/invite-form.tsx` → main client logic  
- `app/api/auth/callback/route.ts` → server callback after OTP

Behavior:

1. User hits `https://.../invite?token=abc123`  
   - `token` maps to `circles.invite_token`.  
2. Invite form asks for **First Name + Phone Number**.  
3. Supabase `signInWithOtp` (Twilio Verify) sends SMS OTP.  
4. After OTP verification:
   - `profiles` row is created/updated with `first_name` + `phone`.  
   - Membership added to `circle_members` using `invite_token`.  
   - **“One circle per user”** enforced via `UNIQUE(user_id)` and logic in callback.  
5. User is redirected to `/dashboard`.

### 5.2 Dashboard

File: `app/dashboard/page.tsx`

- Fetches current user via Supabase server client.  
- Loads:
  - `profile` (first_name)  
  - `circle_members` (circle, circle name)  
  - `currentWeek` via `getCurrentWeek()`  
  - User’s reflection for that week  
  - Circle unlock status via `lib/supabase/unlock.ts`  
- Three main states:
  1. **No reflection yet** → shows “Your reflection isn’t done yet.” + **Start Reflection** button → `/reflection`  
  2. **Reflection submitted but circle not unlocked** → “Your reflection is complete. We’ll text you when everyone is done.”  
  3. **Circle unlocked** → shows `ReadingStatus` + **Read Reflections / Revisit** button.

`ReadingStatus` (`app/dashboard/reading-status.tsx`):

- Uses `localStorage` key `reflection_read_${weekId}` to track if the user finished reading for that week.  
- Shows “Read Reflections” or “Revisit this week’s reflections” accordingly.

### 5.3 Reflection Wizard

File: `app/reflection/page.tsx`

- Client-only, 3-step + review flow: **Rose → Bud → Thorn → Review → Submit**.  
- Draft is stored in React state and persisted to `localStorage` as `reflection_draft_${weekId}`.  
- On mount:
  - Loads `currentWeek` via `getCurrentWeekClient`.  
  - Gets current user and circle membership.  
  - Loads any existing draft from `localStorage`.  
- On submit:
  - Inserts into `reflections` (rose/bud/thorn text, `submitted_at`).  
  - Clears draft from `localStorage`.  
  - Redirects back to `/dashboard` (which now shows waiting/unlocked depending on others).

### 5.4 Unlock Logic

File: `lib/supabase/unlock.ts`

- `isCircleUnlocked(circleId, weekId)`:
  - Fetches circle members.  
  - Checks that each member has a `reflections` row for that week with `submitted_at` not null.  
  - Returns boolean (derived, not persisted).

Dashboard uses this to decide whether reading is available.

### 5.5 Reading Flow (Friend-by-Friend)

File: `app/read/page.tsx` (client component)

- On mount:
  - Authenticates user, gets `currentWeek` via `getCurrentWeekClient`.  
  - Finds user’s circle via `circle_members`.  
  - Loads all *other* members of that circle.  
  - Fetches their reflections for the current week.  
  - **Separately** fetches profiles for those user_ids and builds `user_id → first_name` map (because of RLS on `profiles`).  
- Displays reflections one friend at a time:
  - Title: `"<FriendName>'s Reflection"`  
  - Shows Rose/Bud/Thorn text.  
  - Button:
    - “See \<NextName>’s entry” or
    - “Finish Reading” for the last friend.  
- When finished:
  - Marks week as read in `localStorage` (`reflection_read_${weekId}`).  
  - Shows bloom screen: “Your circle is in full bloom this week. You’re all caught up.”  
  - Returns to dashboard via button.

**Important fix:**  
Because RLS originally blocked reading other profiles, we:

- Added policy `"Users can view profiles in same circle"` on `profiles`.  
- Stopped relying on a direct `profiles` join in the reflections query; instead we:
  - Fetch reflections, extract user_ids, then fetch `profiles` separately, merging them in the app.

---

## 6. Twilio Integration (SMS)

### 6.1 OTP via Twilio Verify (through Supabase)

- Configured in Supabase Auth settings (Verify service, not plain SMS).  
- Used only for `signInWithOtp` in the invite form.  
- No direct Twilio Verify API calls in this codebase; handled by Supabase.

### 6.2 Direct SMS via Twilio (Chunk 9)

Files:

- `lib/twilio/sms.ts`  
  - `sendSMS(to: string, message: string): Promise<string>`  
  - Uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.  
  - Throws a detailed error if any env vars are missing.
- `app/api/test-sms/route.ts`  
  - POST endpoint that:
    - Validates env vars are present.  
    - Accepts JSON `{ phoneNumber }`.  
    - Sends a test SMS using `sendSMS`.  
    - Returns `messageSid` or a detailed error.
- `app/test-sms/page.tsx`  
  - Simple test UI:
    - Input for `phoneNumber` (E.164).  
    - Calls `/api/test-sms`.  
    - Displays success or detailed error.

**State:**  
- Test SMS sending works end-to-end to verified numbers (you’ve successfully received messages).

These utilities will be reused for reminder + unlock SMS in later chunks.

---

## 7. Deployment Notes

- Repo: `https://github.com/happypotomus/rose-bud-thorn` (now public).  
- Vercel project builds from `main`. Earlier issues about old commit deployments were resolved once the repo was public and new commits were pushed.  
- `.vercelignore` excludes spec + migrations from the deployment bundle.  
- When TypeScript errors appear in Vercel (e.g., `weekData.id`/type issues), we fix them locally and push; Vercel auto-redeploys.

---

## 8. Chunk Status & Next Steps

**Completed chunks:**

1. Chunk 1 – Repo + env wiring  
2. Chunk 2 – Supabase schema  
3. Chunk 3 – Auth + Invite Flow  
4. Chunk 4 – Week model + `currentWeek`  
5. Chunk 5 – Basic dashboard states  
6. Chunk 6 – Reflection wizard (text-only)  
7. Chunk 7 – Real unlock logic  
8. Chunk 8 – Friend reading flow (text-only)  
9. Chunk 9 – Twilio + SMS sending service (manual test)

**Completed chunks (continued):**

10. Chunk 10 – Supabase cron + reminder SMS
    - Sunday 7pm reminder Edge Function (`supabase/functions/sunday-reminder`)
    - Monday 7pm reminder Edge Function (`supabase/functions/monday-reminder`)
    - Manual trigger API routes (`/api/trigger-sunday-reminder`, `/api/trigger-monday-reminder`)
    - Uses Twilio REST API directly in Edge Functions (Deno environment)
    - Logs all notifications to `notification_logs` table

**Completed chunks (continued):**

11. Chunk 11 – Real-time unlock SMS
    - Unlock SMS utility (`lib/supabase/unlock-sms.ts`)
    - API route (`/api/send-unlock-sms`)
    - Integrated into reflection submission flow
    - Sends SMS to all circle members when everyone has submitted
    - Logs to `notification_logs` with type `unlock`

**Completed chunks (continued):**

12. Chunk 12 – Voice recording + Supabase Storage
    - Audio recorder component (`components/audio-recorder.tsx`)
    - MediaRecorder API integration
    - Supabase Storage upload functionality
    - Audio URLs saved in draft and database
    - Error handling with retry/discard
    - Audio playback in review step

**Next chunk (not started yet):**

- **Chunk 13 – GPT transcription + cleaned transcript**

---

This `context.md` should be enough for a fresh AI session to:

- Understand the current architecture and flows.  
- Know what’s already implemented and why.  
- Safely continue from **Chunk 10** onward without redoing earlier work or re-breaking RLS/Twilio behavior.


