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
- Home & reflection wizard rely on this to know which `week_id` to use.

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
5. User is redirected to `/home`.

### 5.2 Home

File: `app/home/page.tsx`

- Fetches current user via Supabase server client.  
- Loads:
  - `profile` (first_name)  
  - `circle_members` (circle, circle name)  
  - `currentWeek` via `getCurrentWeek()`  
  - User’s reflection for that week  
  - Circle unlock status via `lib/supabase/unlock.ts`  
  - Mid-week join status via `lib/supabase/midweek-join.ts`  
- Four main states:
  1. **Mid-week joiner** → Shows: "The new round for the circle starts [next Sunday 7pm]. We'll notify you when the time is ready!" (prevents submission for current week)
  2. **No reflection yet** → shows “Your reflection isn’t done yet.” + **Start Reflection** button → `/reflection`  
  3. **Reflection submitted but circle not unlocked** → “Your reflection is complete. We’ll text you when everyone is done.”  
  4. **Circle unlocked** → shows `ReadingStatus` + **Read Reflections / Revisit** button.

`ReadingStatus` (`app/home/reading-status.tsx`):

- Uses `localStorage` key `reflection_read_${weekId}` to track if the user finished reading for that week.  
- Shows “Read Reflections” or “Revisit this week’s reflections” accordingly.

### 5.3 Reflection Wizard

File: `app/reflection/page.tsx`

- Client-only, 3-step + review flow: **Rose → Bud → Thorn → Review → Submit**.  
- Draft is stored in React state and persisted to `localStorage` as `reflection_draft_${weekId}`.  
- On mount:
  - Loads `currentWeek` via `getCurrentWeekClient`.  
  - Gets current user and circle membership (including `created_at`).  
  - **Checks if user joined mid-week** (compares `circle_members.created_at` with `weeks.start_at`).  
  - If joined mid-week, redirects to `/home` (prevents submission for current week).  
  - Loads any existing draft from `localStorage`.  
- On submit:
  - Inserts into `reflections` (rose/bud/thorn text, `submitted_at`).  
  - Clears draft from `localStorage`.  
  - Redirects back to `/home` (which now shows waiting/unlocked depending on others).
- **Mobile UX:** Responsive design with mobile-first spacing, larger touch targets, safe area support

### 5.4 Unlock Logic

File: `lib/supabase/unlock.ts`

- `isCircleUnlocked(circleId, weekId)`:
  - Fetches circle members with their `created_at` timestamps.  
  - Filters to only members who joined **before or at** the week start (excludes mid-week joiners).  
  - Checks that each pre-week member has a `reflections` row for that week with `submitted_at` not null.  
  - Returns boolean (derived, not persisted).  
  - **Mid-week joiners are excluded** from unlock requirements (they can't participate in the current week).

Dashboard uses this to decide whether reading is available.

### 5.5 Mid-Week Join Handling

Files:
- `lib/supabase/midweek-join.ts` - Helper functions for mid-week join detection
- `app/home/page.tsx` - Shows special message for mid-week joiners
- `app/reflection/page.tsx` - Blocks access for mid-week joiners
- `supabase/functions/sunday-reminder/index.ts` - Excludes mid-week joiners from reminders
- `supabase/functions/monday-reminder/index.ts` - Excludes mid-week joiners from reminders

Behavior:

- **Detection**: Compares `circle_members.created_at` with `weeks.start_at` to determine if a user joined after the week started.
- **Mid-week joiner flow**:
  - User joins circle mid-week (e.g., Wednesday after week started Sunday 7pm).
  - Home page shows: "The new round for the circle starts [next Sunday 7pm]. We'll notify you when the time is ready!"
  - User cannot access `/reflection` page (redirects to home).
  - User is excluded from unlock checks (doesn't block existing members from unlocking).
  - User does not receive reminder SMS for the current week.
  - User can participate starting from the next week (next Sunday 7pm).

**Helper functions:**
- `didUserJoinMidWeek(userId, weekId, supabaseClient?)` - Returns true if user joined after week started.
- `getNextWeekStart(currentWeekEnd)` - Calculates next Sunday 7pm date for display.

### 5.6 Reading Flow (Friend-by-Friend)

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

**Important fixes:**  
- RLS fix: Added policy `"Users can view profiles in same circle"` on `profiles`. Stopped relying on a direct `profiles` join in the reflections query; instead we fetch reflections, extract user_ids, then fetch `profiles` separately, merging them in the app.
- Auth redirect: Unauthenticated users clicking SMS link are redirected to `/invite` to log in with phone number + OTP.
- **Mobile UX:** Responsive design with mobile-first spacing, larger touch targets, safe area support, improved typography scaling

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
  - `normalizePhoneNumber(phone: string): string` - Normalizes phone numbers to E.164 format
    - Handles numbers with or without `+` prefix
    - Assumes US numbers (+1) if no country code is present
    - Automatically called by `sendSMS` before sending
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

## 7. Mobile UX & Responsive Design

### 7.1 Mobile-First Approach

- All pages use responsive Tailwind classes with mobile-first breakpoints (`sm:`, `md:`)
- Safe area insets: CSS utilities in `app/globals.css` (`.pb-safe`, `.mb-safe`, `.pt-safe`, `.px-safe`)
- Viewport configuration: `viewportFit: 'cover'` in `app/layout.tsx` for safe area support
- Touch targets: Minimum 44px height for all interactive elements
- Typography: Responsive font scaling for better mobile readability

### 7.2 Components with Mobile Optimizations

- **Reflection Wizard** (`app/reflection/page.tsx`): Responsive padding, larger textareas, full-width buttons on mobile
- **Review Reflections** (`app/read/page.tsx`): Improved spacing, larger text, better button layout
- **AudioRecorder** (`components/audio-recorder.tsx`): Full-width buttons on mobile, better spacing
- **Home**: Export buttons and navigation optimized for mobile

---

## 8. Deployment Notes

- Repo: `https://github.com/happypotomus/rose-bud-thorn` (now public).  
- Vercel project builds from `main`. Earlier issues about old commit deployments were resolved once the repo was public and new commits were pushed.  
- `.vercelignore` excludes spec + migrations from the deployment bundle.  
- When TypeScript errors appear in Vercel (e.g., `weekData.id`/type issues), we fix them locally and push; Vercel auto-redeploys.

---

## 9. Chunk Status & Next Steps

**Completed chunks:**

1. Chunk 1 – Repo + env wiring  
2. Chunk 2 – Supabase schema  
3. Chunk 3 – Auth + Invite Flow  
4. Chunk 4 – Week model + `currentWeek`  
5. Chunk 5 – Basic home states  
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
    - **Updated:** Both reminder functions exclude mid-week joiners (only send to members who joined before/at week start)

**Completed chunks (continued):**

11. Chunk 11 – Real-time unlock SMS
    - Unlock SMS utility (`lib/supabase/unlock-sms.ts`)
    - API route (`/api/send-unlock-sms`)
    - Integrated into reflection submission flow
    - Sends SMS to all circle members when everyone has submitted
    - Logs to `notification_logs` with type `unlock`
    - **Bug fixes:**
      - Phone number normalization: Automatically converts phone numbers to E.164 format before sending
      - Duplicate prevention: Checks `notification_logs` to prevent sending multiple unlock SMS to the same user for the same week
      - Reading link: SMS message includes a link to `/read` page so users can immediately view reflections
      - Base URL detection: Extracts app URL from request headers (production) or environment variables

**Completed chunks (continued):**

12. Chunk 12 – Voice recording + Supabase Storage
    - Audio recorder component (`components/audio-recorder.tsx`)
    - MediaRecorder API integration
    - Supabase Storage upload functionality
    - Audio URLs saved in draft and database
    - Error handling with retry/discard
    - Audio playback in review step

13. Chunk 13 – GPT transcription + cleaned transcript + export feature
    - OpenAI Whisper API integration for transcription (`lib/openai/transcribe.ts`)
    - GPT-4o-mini for transcript cleaning (removes filler words: um, uh, etc.)
    - Transcription API route (`/api/transcribe-audio`)
    - Automatic transcription trigger after reflection submission
    - Reading UI with audio player and "View Transcribed Version" toggle
    - Transcript display with error handling
    - Export reflection feature (`app/home/export-reflection.tsx`)
      - Copy to clipboard
      - Download as text (.txt)
      - Download as Markdown (.md)
      - Combines text + transcripts (prefers text, falls back to cleaned transcript)
    - **Bug fix:** Export reflection data serialization
      - Explicitly maps reflection data when passing from server to client component
      - Converts empty strings to `null` for proper handling (empty strings come from audio-only submissions)
      - Ensures proper serialization of all fields (rose_text, bud_text, thorn_text, transcripts)
      - Fixes issue where export showed "(No response)" even when data existed in Supabase
      - Handles cases where users only record audio (no typed text) - exports will show transcripts when available

**Next chunk (not started yet):**

- **Chunk 14 – Polishing + small QA**
  - Ensure all flows respect one circle per user, mid-week join behavior, linear reading sequence, all three home states
  - Add basic loading/error states
  - Confirm RLS isn't blocking normal use
  - Clean up routes, components, and environment variable usage
  - Final README with: how to run dev, how to seed circles, how to run cron manually in dev

---

## 📋 Chunk Completion Checklist

### ✅ Completed Chunks (1-13)

- [x] **Chunk 1** – Repo + env wiring
- [x] **Chunk 2** – Supabase schema (DB only, no UI yet)
- [x] **Chunk 3** – Auth + Invite Flow
- [x] **Chunk 4** – Week model + `currentWeek`
- [x] **Chunk 5** – Basic home states
- [x] **Chunk 6** – Reflection wizard (text-only)
- [x] **Chunk 7** – Real unlock logic (no SMS yet)
- [x] **Chunk 8** – Friend reading flow (text-only)
- [x] **Chunk 9** – Twilio + SMS sending service (manual test)
- [x] **Chunk 10** – Supabase cron + reminder SMS
- [x] **Chunk 11** – Real-time unlock SMS
- [x] **Chunk 12** – Voice recording + Supabase Storage
- [x] **Chunk 13** – GPT transcription + cleaned transcript + export feature

### ⏳ Remaining Chunks

- [ ] **Chunk 14** – Polishing + small QA

---

## 🎯 Quick Status Summary

**Completed:** 13 of 14 chunks (93% complete)

**Recent Bug Fixes (Post-Chunk 13):**
- Fixed export reflection showing "(No response)" - explicit data serialization with empty string to null conversion
- Fixed unlock SMS not sending to users with phone numbers missing `+` prefix - phone number normalization
- Added duplicate prevention for unlock SMS - checks notification_logs before sending
- Added reading link to unlock SMS message - users can click to immediately view reflections
- Improved auth redirect in reading page - unauthenticated users redirected to `/invite`

**Recent UX Improvements (Post-Chunk 13):**
- Audio recorder: Fixed progress bar real-time updates during playback, added playback speed controls (1x/1.5x), added restart button
- Audio recorder state management: Fixed audio persisting across reflection steps (rose/bud/thorn) - now properly resets per section
- Navigation buttons: Updated to always display on same line with 50/50 split (Back/Next buttons)
- Review page: Added emoji icons (🌹 Rose, 🌱 Bud, 🌵 Thorn) to section headings
- Export feature: Enhanced to show "Audio response" for audio-only submissions instead of "(No response)"

**Mobile UX Improvements (Post-Chunk 13):**
- Applied mobile-first responsive design across reflection wizard and review reflections section
- Responsive padding: `px-4 py-6 sm:p-12 md:p-24` (reduced on mobile, full on desktop)
- Larger touch targets: buttons minimum 44px height with `py-3` padding
- Typography scaling: responsive font sizes (`text-base sm:text-lg`, `text-xl sm:text-2xl md:text-3xl`)
- Full-width buttons on mobile: `w-full sm:w-auto` for easier tapping
- Safe area support: Added CSS utilities (`.pb-safe`, `.mb-safe`) and viewport meta tag with `viewportFit: 'cover'`
- Improved spacing: Increased gaps between elements, better card padding, more breathing room
- Applied to:
  - Reflection wizard (`app/reflection/page.tsx`)
  - Review reflections section (`app/read/page.tsx`)
  - AudioRecorder component (`components/audio-recorder.tsx`)
  - Loading/error/bloom screens

**Mid-Week Join Feature (Post-Chunk 13):**
- Added mid-week join detection (`lib/supabase/midweek-join.ts`)
- Updated unlock logic to exclude mid-week joiners from unlock requirements
- Home page shows special message for mid-week joiners about next round starting Sunday 7pm
- Reflection page blocks access for mid-week joiners (redirects to home)
- Reminder SMS (Sunday/Monday) excludes mid-week joiners
- **Scenario handled:** User joins Wednesday, everyone else finished Monday → new user sees message, can't submit, doesn't block unlock

**Remaining Work:**
- Final polish and QA
- Documentation (README)
- Edge case verification

---

This `context.md` should be enough for a fresh AI session to:

- Understand the current architecture and flows.  
- Know what’s already implemented and why.  
- Safely continue from **Chunk 10** onward without redoing earlier work or re-breaking RLS/Twilio behavior.


