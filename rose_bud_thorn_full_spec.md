# Rose–Bud–Thorn App — Medium‑Detail Technical Specification (Full Version)

---

# 1. Purpose & Product Overview

The **Rose–Bud–Thorn (RBT) App** is a lightweight, intimate weekly ritual tool designed for small private circles to reflect every Sunday using three prompts:

- **Rose** — what went well this week
- **Bud** — something emerging or full of potential
- **Thorn** — something challenging during the week

The core values guiding the app:

- Emotional intimacy
- Low friction, low cognitive load
- A weekly recurring ritual
- High signal, minimal interface
- Small trusted circles (2–10 people)
- Clean, simple UX that feels warm and human

This spec defines the entire v1 build for a **3‑week pilot experiment** with **two isolated circles**:

- Your circle
- Your girlfriend’s circle

Nothing should mix between circles.

This document includes:

- Architecture
- Data model
- Auth, onboarding, and invite flow
- Weekly cycle logic
- Reflection wizard (text + audio)
- Audio upload + retry behavior
- GPT transcription + transcript UI
- SMS reminder + unlock SMS
- Error states and how to handle them
- Admin rules
- Chunk‑by‑chunk build plan for Cursor
- Best practices for using Cursor + Codex

This file is intended to be the **single source of truth** for Cursor‑powered development.

---

# 2. High‑Level Architecture

**Frontend:**

- Next.js 14 (App Router)
- TypeScript
- TailwindCSS + Shadcn UI
- React Server Components for data fetching
- Client components for recording, uploading, form wizard

**Backend:**

- Supabase (Postgres, Auth, RLS, Storage, Cron, Edge Functions)
- OpenAI (transcription + cleanup)
- Twilio (SMS sending)

**Data Flow Summary:**

1. Users join a **circle** via unique invite link
2. Each week auto‑generates a **week** row on Sunday 7pm
3. User completes Rose → Bud → Thorn (text + optional audio)
4. Submission written to DB
5. Once all circle members submit → **circle unlocks**
6. Unlock SMS sent
7. Users read each other’s entries sequentially

---

# 3. Data Model

## 3.1 Tables

### `profiles`

Stores minimal user identity.

| column      | type        | notes                 |
| ----------- | ----------- | --------------------- |
| id          | uuid (PK)   | mirrors auth.users.id |
| first\_name | text        | required              |
| phone       | text unique | required              |
| created\_at | timestamptz | default now()         |

---

### `circles`

Manually create Circle A + Circle B before experiment.

| column        | type        | notes                  |
| ------------- | ----------- | ---------------------- |
| id            | uuid PK     |                        |
| name          | text        | "Pranav’s Circle" etc  |
| invite\_token | text unique | appears in invite link |
| created\_at   | timestamptz |                        |

---

### `circle_members`

Mapping of users → circles.

| column      | type        | notes |
| ----------- | ----------- | ----- |
| id          | uuid PK     |       |
| circle\_id  | uuid FK     |       |
| user\_id    | uuid FK     |       |
| created\_at | timestamptz |       |

**Rules:**

- A user can only belong to **one** circle.
- Attempting to join a second → redirect to original circle.

---

### `weeks`

Auto‑generated via cron.

| column      | type        | notes              |
| ----------- | ----------- | ------------------ |
| id          | uuid PK     |                    |
| start\_at   | timestamptz | Sunday 7pm         |
| end\_at     | timestamptz | next Sunday 6:59pm |
| created\_at | timestamptz |                    |

---

### `reflections`

One reflection per user per circle per week.

| column            | type        |
| ----------------- | ----------- |
| id                | uuid PK     |
| circle\_id        | uuid        |
| week\_id          | uuid        |
| user\_id          | uuid        |
| rose\_text        | text        |
| bud\_text         | text        |
| thorn\_text       | text        |
| rose\_audio\_url  | text        |
| bud\_audio\_url   | text        |
| thorn\_audio\_url | text        |
| rose\_transcript  | text        |
| bud\_transcript   | text        |
| thorn\_transcript | text        |
| submitted\_at     | timestamptz |

**Constraint:**

- Unique: `(user_id, circle_id, week_id)`

---

### `notification_logs`

Tracks all dispatched SMS events.

| column     | type        | notes                                           |
| ---------- | ----------- | ----------------------------------------------- |
| id         | uuid PK     |                                                 |
| user\_id   | uuid        |                                                 |
| circle\_id | uuid        |                                                 |
| week\_id   | uuid        |                                                 |
| type       | text        | "first\_reminder", "second\_reminder", "unlock" |
| message    | text        |                                                 |
| sent\_at   | timestamptz |                                                 |

---

# 4. Authentication & Invite Flow

## 4.1 Invite Link URL

```
https://yourapp.com/invite?token=abc123
```

Token comes from `circles.invite_token`.

**Invalid token behavior:** Display a soft, human message:

> "This invite link doesn’t seem to be active. It might be old or typed incorrectly. Please ask the person who invited you to resend it."

---

## 4.2 Onboarding

1. User taps invite link
2. Enter **First Name + Phone**
3. If phone exists → treat as login
4. If phone new → create user + profile
5. Send OTP via Supabase
6. After successful OTP:
   - If user already in a circle → redirect to their circle dashboard
   - If not → add to circle using invite token

**Rule (locked):**\
A user cannot switch circles. If they tap another circle’s link, they’re redirected to their existing circle.

---

# 5. Weekly Cycle Logic

## 5.1 Sunday 7pm Cron

Creates a new `weeks` row:

- `start_at = now`
- `end_at = next Sunday 6:59pm`

Then:

- Sends **first SMS reminder** to every member in each circle.

Cron includes auto‑retry + safety check to prevent double weeks.

---

## 5.2 Monday 7pm Cron

Finds members with no reflection submitted. Sends **second SMS reminder**:

> "Gentle reminder to complete your weekly reflection."

---

## 5.3 Unlock Logic

Whenever a reflection is submitted:

- Check if all users in the circle submitted
- If yes:
  - Trigger unlock SMS
  - Dashboard state changes to "Read Reflections"

Unlock SMS:

> "Everyone in your circle has submitted! You can now read each other's reflections."

---

# 6. Reflection Wizard UX

## 6.1 Steps

1. Rose
2. Bud
3. Thorn
4. Review
5. Submit

Linear, cannot skip.

Draft saved to localStorage.

---

## 6.2 Audio Recording UI

For each step:

- Record → Stop → Preview
- Keep → upload to Supabase Storage
- Discard → delete local blob

**If upload fails:** Show:

> "We couldn’t upload your audio. Please try again." Buttons:

- Retry Upload
- Discard Recording

---

## 6.3 Submission

On submit:

- Write text + audio URLs
- Set `submitted_at`
- Trigger unlock check
- Dashboard state becomes:\
  "Your reflection is complete. We’ll text you when everyone is done."

---

# 7. Friend Reading Flow

## 7.1 Sequence

After unlock:

- User sees **Read Reflections** button
- For each friend in the circle:
  - Show their Rose/Bud/Thorn
  - If audio exists → show audio player
  - If transcript exists → “View Transcribed Version” toggle
  - At bottom: \*\*“See \*\***’s entry”**
- After last friend → bloom screen:

> "Your circle is in full bloom this week. You’re all caught up."

Dashboard changes to:

- "Revisit this week’s reflections"

---

## 7.2 Transcript Behavior

If audio exists but transcription fails:

- Show transcript toggle
- On expand → show:

> "We couldn’t generate a transcript for this recording. Please listen to the audio instead."

---

# 8. SMS Logic

## 8.1 First Reminder (Sunday)

> "Hey , it’s time for your weekly Rose–Bud–Thorn reflection."

## 8.2 Second Reminder (Monday)

> "Gentle reminder to complete your weekly reflection."

## 8.3 Unlock SMS

> "Everyone in your circle has submitted! You can now read each other's reflections."

---

# 9. Audio + Transcription Pipeline

## 9.1 Audio Recording

- Browser MediaRecorder API
- Save blob locally
- Upload on Keep

## 9.2 Transcription

Edge Function:

1. Fetch audio file
2. Call OpenAI audio API
3. Clean + format transcript using GPT
4. Write transcript into DB

## 9.3 Failure Handling

- Upload fails → Retry / Discard
- Transcript fails → friendly fallback

---

# 10. Error States

### Invalid invite link

Soft error message.

### Existing phone

Treat as login.

### Reflection submit failure

"Something went wrong while saving your reflection. Please try again."\
Stay on Review screen, local draft preserved.

### Audio upload failure

Retry / discard.

### Transcript failure

"We couldn’t generate a transcript…"

### Cron failure

Edge Function retries with safety check.

### Admin removal

Immediate and affects unlock logic in real‑time.

---

# 11. Admin Rules

- Admin can remove members at any time via DB.
- Removal effective immediately.
- Removed members do not count toward unlock.

---

# 12. Cursor Build Chunks (Implementation Plan)

### **Chunk 1 – Repo + env wiring**

- Init Next.js 14 (App Router, TS, Tailwind, shadcn).
- Add basic layout + placeholder home page.
- Add `.env` handling for:
  - Supabase URL + anon key
  - OpenAI key (for later)
  - Twilio creds (for later)
- Git init, first commit.

**Outcome:** You can run `pnpm dev` and see a barebones app.

---

### **Chunk 2 – Supabase schema (DB only, no UI yet)**

Create tables + relationships:

- `profiles`
- `circles`
- `circle_members`
- `weeks`
- `reflections`
- `notification_logs`

Plus:

- Foreign keys
- Unique constraints (e.g., one reflection per user per week per circle)
- Basic RLS policies stubbed (even if lax for now)

**Outcome:** Schema exists, migrations applied, Supabase Studio shows the correct tables.

---

### **Chunk 3 – Auth + Invite Flow (no “app” yet)**

Implement:

- `/invite?token=...` page:
  - First name + phone form
  - Calls Supabase SMS OTP (`signInWithOtp`)
- OTP verification flow:
  - After success:
    - Create `profiles` row if needed
    - Attach user to circle from `invite_token`
    - Enforce “one circle per user” rule
    - Handle: already in circle → redirect to dashboard

**Outcome:** Someone can tap a circle link, onboard via SMS, and land on a placeholder dashboard.

---

### **Chunk 4 – Week model + “current week” detection**

Implement:

- Supabase Edge Function or RPC to get/create the **current week**.
- Logic on the Next.js side:
  - Fetch `currentWeek` when user hits dashboard.
  - Make sure the app “knows” which week ID to use.

**Outcome:** The app always has a clear `currentWeek` object available.

---

### **Chunk 5 – Basic dashboard states (no reflection form yet)**

Implement dashboard with 3 states:

1. **No reflection yet** → show:\
   “Your reflection isn’t done yet.” + **Start Reflection** button
2. **Reflection submitted but circle not unlocked** → show:\
   “Your reflection is complete.” + “We’ll text you when everyone is done.”
3. **Circle unlocked & user already read everything** → placeholder\
   (we’ll wire actual reading later)

For now, fake the underlying checks with stubbed data or simple flags.

**Outcome:** You can log in as a test user and see the correct state *based on mock data / simple logic*.

---

### **Chunk 6 – Reflection wizard (text-only first)**

Implement the 3-step wizard with **local draft only**:

- Rose → Bud → Thorn → Review → Submit
- Strict linear flow
- Draft persisted in `localStorage`
- On submit:
  - Create `reflections` row (Rose/Bud/Thorn text, no audio yet)
  - `submitted_at` recorded
- After submit → show “waiting for others” dashboard state.

**Outcome:** You can fully complete a reflection (text-only), and it writes to DB correctly.

---

### **Chunk 7 – Real unlock logic (no SMS yet)**

Implement server logic:

- For a given circle + week:
  - Check if every member has a `reflections` row
- Use that in:
  - Dashboard (“waiting for others” vs “unlocked”)
  - A simple unlocked flag in the UI (derived, not stored)

**Outcome:** With a few test users in a circle, you can simulate submissions and see unlock behavior.

---

### **Chunk 8 – Friend reading flow (text-only)**

Implement:

- After unlock → **Read Reflections** button on dashboard
- Friend-by-friend page:
  - Show Friend 1’s Rose/Bud/Thorn text
  - Button at bottom: **“See \<Name>’s entry”**
- After last friend → 🌸 “Your circle is in full bloom this week. You’re all caught up.”
- Dashboard shows **“Revisit this week’s reflections”** when fully caught up.

**Outcome:** You can go through the whole ritual text-only, end-to-end.

---

### **Chunk 9 – Twilio + SMS sending service (manual trigger first)**

Implement Twilio integration:

- Server utility function to send SMS to a given phone number.
- A temporary “admin-only” route or script that:
  - Sends a test SMS to your number
  - Confirms connectivity

**Outcome:** You can reliably send a test SMS from the app.

---

### **Chunk 10 – Supabase cron + reminder SMS**

Implement:

- Sunday 7pm cron → Edge Function:
  - Get all circles + members for current week
  - Create `notification_logs` rows
  - Send **personalized** first reminder SMS
- Monday 7pm cron → Edge Function:
  - Get non-submitters per circle
  - Log + send second reminder SMS

**Outcome:** With cron manually triggered in dev, you can see real reminder SMS go out.

---

### **Chunk 11 – Real-time unlock SMS**

On reflection submission:

- After inserting reflection, check:\
  “Is everyone in this circle done for this week?”
- If yes:
  - Log unlock SMS in `notification_logs`
  - Call Twilio to send “Everyone’s finished, you can now read each other’s entries.”

**Outcome:** In dev, you can submit as last user and watch the unlock SMS hit your phone.

---

### **Chunk 12 – Voice recording + Supabase Storage**

Implement on the client:

- Per section (Rose/Bud/Thorn):
  - Record → Stop → Preview → Keep/Discard
- On Keep:
  - Upload to Supabase Storage
  - Save URL in local draft → then in `reflections` on submit
- Upload failure behavior:
  - Error: “We couldn’t upload your audio. Please try again.”
  - Buttons: **Retry Upload** / **Discard Recording**

**Outcome:** You can add audio to any part of your reflection and see URLs in DB.

---

### **Chunk 13 – GPT transcription + cleaned transcript**

Implement:

- Backend function that:
  - Takes audio URL → fetches file
  - Sends to OpenAI audio API
  - Cleans result via GPT (formatting, paragraphs, light filler cleanup)
  - Writes into `rose_transcript_text`, `bud_transcript_text`, etc.
- Reading UI:
  - If audio present → show player + “View Transcribed Version” toggle
  - On toggle:
    - If transcript exists → show transcript
    - If transcript failed → show:
      > “We couldn’t generate a transcript for this recording. Please listen to the audio instead.”

**Outcome:** You can record audio, submit, then later read your friend’s entry with audio + transcript.

---

### **Chunk 14 – Polishing + small QA**

- Ensure all flows respect:
  - One circle per user
  - Mid-week join behavior
  - Linear reading sequence
  - All three dashboard states
- Add basic loading/error states
- Confirm RLS isn’t blocking normal use
- Clean up routes, components, and environment variable usage
- Final README with:
  - How to run dev
  - How to seed circles
  - How to run cron manually in dev

