# Rose–Bud–Thorn Architecture Documentation

This document serves as the **source of truth** for understanding how the Rose–Bud–Thorn app is built, how components relate to each other, and the intention behind each function. Use this when building new features to understand existing patterns and maintain consistency.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack & Infrastructure](#2-tech-stack--infrastructure)
3. [Data Model & Database Architecture](#3-data-model--database-architecture)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Core Data Flows](#5-core-data-flows)
6. [Component Architecture](#6-component-architecture)
7. [API Routes & Server Functions](#7-api-routes--server-functions)
8. [Utility Libraries](#8-utility-libraries)
9. [Integration Points](#9-integration-points)
10. [State Management Patterns](#10-state-management-patterns)
11. [File Organization](#11-file-organization)
12. [Key Design Decisions](#12-key-design-decisions)

---

## 1. System Overview

### 1.1 Purpose

Rose–Bud–Thorn is a **weekly reflection ritual app** for small private circles (2–10 people). Each week, users reflect on:
- **Rose**: What went well
- **Bud**: Something emerging or full of potential
- **Thorn**: Something challenging

### 1.2 Core Workflow

```
User joins circle via invite link
  ↓
Week starts (Sunday 7pm) → Auto-generated week row
  ↓
User completes reflection (Rose → Bud → Thorn)
  ↓
Submission saved to database
  ↓
When all members submit → Circle unlocks
  ↓
Unlock SMS sent to all members
  ↓
Users read each other's reflections sequentially
```

### 1.3 Architectural Principles

- **Server Components First**: Data fetching happens on the server for better performance and SEO
- **Client Components for Interactivity**: Only use client components when needed (forms, audio recording, state)
- **RLS for Security**: Row Level Security policies enforce data access at the database level
- **Fire-and-Forget for Background Tasks**: SMS sending, transcription happen asynchronously
- **Mobile-First Design**: All UI is responsive with mobile-first breakpoints

---

## 2. Tech Stack & Infrastructure

### 2.1 Frontend

- **Next.js 16** (App Router)
  - Server Components for data fetching
  - Client Components for interactivity
  - API Routes for server-side logic
- **React 19** with TypeScript
- **TailwindCSS 3** for styling
- **Shadcn UI** for component library

### 2.2 Backend

- **Supabase** (PostgreSQL database)
  - Auth (phone OTP via Twilio Verify)
  - Row Level Security (RLS) policies
  - Storage (for audio files)
  - Edge Functions (for cron jobs)
  - Postgres Functions (for week logic)
- **Twilio** (SMS sending)
- **OpenAI** (Whisper for transcription, GPT-4o-mini for cleaning)

### 2.3 Deployment

- **Vercel** for hosting
- **GitHub** for version control
- **Supabase Cloud** for database

---

## 3. Data Model & Database Architecture

### 3.1 Core Tables

#### `profiles`
**Purpose**: Minimal user identity (mirrors `auth.users`)

**Schema**:
- `id` (UUID, PK) → References `auth.users.id`
- `first_name` (TEXT, required)
- `phone` (TEXT, unique, required)
- `sms_consent_at` (TIMESTAMPTZ, nullable) → Timestamp when user consented to SMS (A2P 10DLC compliance)
- `sms_opted_out_at` (TIMESTAMPTZ, nullable) → Timestamp when user opted out (STOP command)
- `created_at` (TIMESTAMPTZ)

**Relationships**:
- One-to-one with `auth.users`
- One-to-many with `circle_members`
- One-to-many with `reflections`

**Key Constraint**: `phone` must be unique (enforced at DB level)

**SMS Compliance**:
- `sms_consent_at`: Set when user provides phone during signup (implicit consent)
- `sms_opted_out_at`: Set when user replies STOP or Twilio reports opt-out (error code 21610)
- All SMS sending functions check `sms_opted_out_at` before sending

---

#### `circles`
**Purpose**: Represents a private group of users

**Schema**:
- `id` (UUID, PK)
- `name` (TEXT) → Display name like "Pranav's Circle"
- `invite_token` (TEXT, unique) → Used in invite URLs
- `circle_owner` (TEXT, optional) → Owner name
- `invite_link` (TEXT, optional) → Full invite URL
- `created_at` (TIMESTAMPTZ)

**Relationships**:
- One-to-many with `circle_members`
- One-to-many with `reflections`

**Key Constraint**: `invite_token` must be unique

---

#### `circle_members`
**Purpose**: Junction table mapping users to circles

**Schema**:
- `id` (UUID, PK)
- `circle_id` (UUID, FK → `circles.id`)
- `user_id` (UUID, FK → `profiles.id`)
- `created_at` (TIMESTAMPTZ) → Used for mid-week join detection

**Relationships**:
- Many-to-one with `circles`
- Many-to-one with `profiles`

**Key Constraint**: `UNIQUE(user_id)` → **One circle per user** (v1.0)

**Important**: The `created_at` timestamp is critical for:
- Mid-week join detection (compares with `weeks.start_at`)
- Unlock logic (excludes mid-week joiners)

---

#### `weeks`
**Purpose**: Represents a weekly cycle (Sunday 7pm → next Sunday 6:59pm)

**Schema**:
- `id` (UUID, PK)
- `start_at` (TIMESTAMPTZ) → Sunday 7pm
- `end_at` (TIMESTAMPTZ) → Next Sunday 6:59pm
- `created_at` (TIMESTAMPTZ)

**Relationships**:
- One-to-many with `reflections`
- One-to-many with `notification_logs`

**Key Logic**: Weeks are auto-generated via `get_or_create_current_week()` RPC function

---

#### `reflections`
**Purpose**: User's weekly reflection entry

**Schema**:
- `id` (UUID, PK)
- `circle_id` (UUID, FK → `circles.id`)
- `week_id` (UUID, FK → `weeks.id`)
- `user_id` (UUID, FK → `profiles.id`)
- `rose_text` (TEXT, nullable)
- `bud_text` (TEXT, nullable)
- `thorn_text` (TEXT, nullable)
- `rose_audio_url` (TEXT, nullable) → Supabase Storage URL
- `bud_audio_url` (TEXT, nullable)
- `thorn_audio_url` (TEXT, nullable)
- `rose_transcript` (TEXT, nullable) → GPT-cleaned transcript
- `bud_transcript` (TEXT, nullable)
- `thorn_transcript` (TEXT, nullable)
- `submitted_at` (TIMESTAMPTZ, nullable) → NULL = draft, timestamp = submitted

**Relationships**:
- Many-to-one with `circles`
- Many-to-one with `weeks`
- Many-to-one with `profiles`

**Key Constraint**: `UNIQUE(user_id, circle_id, week_id)` → One reflection per user per circle per week

**Design Decision**: Text and audio are nullable because users can submit text-only, audio-only, or both.

---

#### `notification_logs`
**Purpose**: Audit trail of all SMS notifications sent

**Schema**:
- `id` (UUID, PK)
- `user_id` (UUID, FK → `profiles.id`)
- `circle_id` (UUID, FK → `circles.id`)
- `week_id` (UUID, FK → `weeks.id`)
- `type` (TEXT) → `'first_reminder'`, `'second_reminder'`, or `'unlock'`
- `message` (TEXT) → Full SMS message sent
- `sent_at` (TIMESTAMPTZ)

**Purpose**: 
- Prevents duplicate SMS sends
- Provides audit trail
- Used by unlock SMS logic to check if user already received notification

---

### 3.2 Database Functions

#### `get_or_create_current_week()`
**Location**: `supabase/migrations/20250121000013_fix_week_function_simple.sql`

**Purpose**: Returns the current week, creating it if it doesn't exist

**Logic**:
1. Finds week where `NOW()` is between `start_at` and `end_at`
2. If found, returns it
3. If not found, calculates:
   - `start_at`: Most recent Sunday 7pm
   - `end_at`: Next Sunday 6:59pm
4. Creates and returns new week

**Why RPC?**: 
- Ensures week creation is atomic
- Can be called from both server and client components
- Handles edge cases (first week, timezone issues)

**Usage**:
- Server: `lib/supabase/week-server.ts` → `getCurrentWeek()`
- Client: `lib/supabase/week.ts` → `getCurrentWeekClient(supabase)`

---

### 3.3 Indexes

**Performance indexes** (from initial schema):
- `idx_circle_members_circle_id` → Fast circle member lookups
- `idx_circle_members_user_id` → Fast user circle lookups
- `idx_reflections_circle_id` → Fast reflection queries by circle
- `idx_reflections_week_id` → Fast reflection queries by week
- `idx_reflections_user_id` → Fast reflection queries by user
- `idx_notification_logs_*` → Fast notification log queries
- `idx_profiles_sms_opted_out` → Fast opt-out filtering (partial index on `sms_opted_out_at IS NOT NULL`)

---

## 4. Authentication & Authorization

### 4.1 Authentication Flow

**Provider**: Supabase Auth with Twilio Verify

**Flow**:
1. User enters phone number + first name on invite page
2. `signInWithOtp()` sends SMS OTP via Twilio Verify (configured in Supabase dashboard)
3. User enters OTP
4. Supabase creates/updates `auth.users` record
5. Frontend calls `/api/auth/callback` with user data
6. Server creates/updates `profiles` row and adds to `circle_members`
7. User redirected to `/home`

**Files**:
- `app/invite/page.tsx` → Server component wrapper
- `app/invite/invite-form.tsx` → Client component with OTP flow
- `app/api/auth/callback/route.ts` → Server-side profile/membership creation

---

### 4.2 Supabase Client Architecture

#### Server Client (`lib/supabase/server.ts`)
**Purpose**: Create Supabase client for Server Components and API routes

**Key Features**:
- Uses `@supabase/ssr` for cookie-based session management
- Handles cookie reading/writing for Next.js App Router
- Automatically refreshes expired sessions via middleware

**Usage Pattern**:
```typescript
const supabase = await createClient()
// Use in Server Components or API routes
```

**Why Separate?**: Server components can't use browser APIs, need cookie-based auth

---

#### Client Client (`lib/supabase/client.ts`)
**Purpose**: Create Supabase client for Client Components

**Key Features**:
- Uses `@supabase/ssr` browser client
- Handles browser-based session management
- Works in React components with hooks

**Usage Pattern**:
```typescript
const supabase = createClient()
// Use in Client Components
```

---

### 4.3 Row Level Security (RLS)

**Purpose**: Enforce data access at the database level, not application level

**Philosophy**: "Deny by default, allow explicitly"

#### RLS Policy Patterns

**1. User's Own Data**
```sql
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
```
**Intention**: Users can only see their own profile by default

---

**2. Circle-Based Access**
```sql
CREATE POLICY "View reflections in own circle" ON reflections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members
      WHERE circle_members.circle_id = reflections.circle_id
      AND circle_members.user_id = auth.uid()
    )
  );
```
**Intention**: Users can only see reflections from circles they belong to

---

**3. Unauthenticated Access (for Invites)**
```sql
CREATE POLICY "Allow circle access for invites and members" ON circles
  FOR SELECT 
  USING (
    (auth.uid() IS NOT NULL AND EXISTS (...))
    OR
    auth.uid() IS NULL  -- Allow unauthenticated for invite flow
  );
```
**Intention**: Allow invite link lookup before user is authenticated

---

**4. Self-Insert Pattern**
```sql
CREATE POLICY "Users can insert own circle membership" ON circle_members
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
```
**Intention**: Users can only add themselves to circles (via invite flow)

---

### 4.4 Service Role Client

**When Used**: API routes that need to bypass RLS

**Example**: `lib/supabase/unlock-sms.ts`
```typescript
const supabase = createClient(supabaseUrl, supabaseServiceKey)
```

**Why Needed**: 
- Unlock SMS needs to check all members' reflection status
- Can't use regular client because RLS would filter results
- Service role has full database access

**Security**: Service role key is **never** exposed to client, only used in API routes

---

## 5. Core Data Flows

### 5.1 Invite + Authentication Flow

**Files**:
- `app/invite/page.tsx` (server component)
- `app/invite/invite-form.tsx` (client component)
- `app/api/auth/callback/route.ts` (API route)

**Flow Diagram**:
```
User visits /invite?token=abc123
  ↓
[Server] invite/page.tsx validates token exists
  ↓
[Client] invite-form.tsx renders form
  ↓
User enters: First Name + Phone
  ↓
[Client] supabase.auth.signInWithOtp() → Twilio sends SMS
  ↓
User enters OTP
  ↓
[Client] supabase.auth.verifyOtp() → Creates auth.users record
  ↓
[Client] POST /api/auth/callback with {userId, firstName, phone, inviteToken}
  ↓
[Server] auth/callback/route.ts:
  - Creates/updates profiles row
  - Checks if user already in circle (UNIQUE constraint)
  - If not, inserts into circle_members
  - Returns success
  ↓
[Client] Redirects to /home
```

**Key Design Decisions**:
- **Server-side profile creation**: Ensures data consistency, handles edge cases
- **Idempotent callback**: If user already in circle, returns success (no error)
- **One circle per user**: Enforced by `UNIQUE(user_id)` constraint + callback logic

---

### 5.2 Week Determination Flow

**Files**:
- `lib/supabase/week-server.ts` (server utility)
- `lib/supabase/week.ts` (client utility)
- `supabase/migrations/*_create_get_current_week_function.sql` (Postgres function)

**Flow**:
```
Component needs current week
  ↓
Calls getCurrentWeek() or getCurrentWeekClient()
  ↓
Calls supabase.rpc('get_or_create_current_week')
  ↓
[Postgres Function] get_or_create_current_week():
  1. SELECT * FROM weeks WHERE NOW() BETWEEN start_at AND end_at
  2. If found → RETURN
  3. If not found:
     - Calculate: last Sunday 7pm
     - Calculate: next Sunday 6:59pm
     - INSERT INTO weeks
     - RETURN new week
  ↓
Returns Week object: {id, start_at, end_at, created_at}
```

**Why This Design?**:
- **Lazy creation**: Weeks created on-demand, not via cron
- **Atomic**: Postgres function ensures no race conditions
- **Idempotent**: Multiple calls return same week
- **Timezone-safe**: Uses Postgres `NOW()` which respects server timezone

**Usage Points**:
- `app/home/page.tsx` → Determines which week's reflection to show
- `app/reflection/page.tsx` → Determines which week to submit for
- `app/read/page.tsx` → Determines which week's reflections to read

---

### 5.3 Reflection Submission Flow

**Files**:
- `app/reflection/page.tsx` (server component - access control)
- `app/reflection/reflection-form.tsx` (client component - form UI)
- `app/api/send-unlock-sms/route.ts` (API route - unlock check)

**Flow**:
```
User clicks "Start Reflection"
  ↓
[Server] reflection/page.tsx:
  - Checks authentication
  - Checks mid-week join status → redirect if joined mid-week
  - Checks if already submitted → redirect if submitted
  - Gets current week
  - Gets user's circle
  ↓
[Client] reflection-form.tsx renders:
  - 3-step wizard: Rose → Bud → Thorn → Review
  - Draft saved to localStorage: reflection_draft_${weekId}
  ↓
User completes form (text + optional audio)
  ↓
User clicks "Submit"
  ↓
[Client] reflection-form.tsx:
  1. Uploads audio files to Supabase Storage (if any)
  2. Inserts reflection into database:
     - rose_text, bud_text, thorn_text
     - rose_audio_url, bud_audio_url, thorn_audio_url
     - submitted_at = NOW()
  3. Clears localStorage draft
  4. Fire-and-forget: POST /api/send-unlock-sms
  5. Fire-and-forget: POST /api/transcribe-audio (if audio exists)
  6. Redirects to /home
  ↓
[Background] /api/send-unlock-sms:
  - Checks if circle is unlocked (isCircleUnlocked)
  - If unlocked, sends SMS to all members
  - Logs to notification_logs
  ↓
[Background] /api/transcribe-audio:
  - Fetches audio from Storage
  - Calls OpenAI Whisper API
  - Cleans transcript with GPT-4o-mini
  - Updates reflection with transcripts
```

**Key Design Decisions**:
- **Server-side access control**: Prevents flash of form before redirect
- **Draft persistence**: localStorage allows users to return to incomplete reflections
- **Fire-and-forget**: SMS and transcription don't block user flow
- **Audio-first**: Users can submit audio-only (text is nullable)

---

### 5.4 Unlock Detection Flow

**Files**:
- `lib/supabase/unlock.ts` → `isCircleUnlocked()`
- `app/home/page.tsx` → Uses unlock status for UI state
- `app/api/send-unlock-sms/route.ts` → Triggers SMS when unlocked

**Flow**:
```
isCircleUnlocked(circleId, weekId) called
  ↓
1. Fetch week.start_at
  ↓
2. Fetch all circle_members for circle
  ↓
3. Filter members: created_at <= week.start_at
   (Excludes mid-week joiners)
  ↓
4. Fetch all reflections for circle + week where submitted_at IS NOT NULL
  ↓
5. Check: Does every pre-week member have a reflection?
  ↓
6. Return: true if all submitted, false otherwise
```

**Key Logic**:
- **Mid-week joiners excluded**: Users who joined after week started don't block unlock
- **Derived state**: Unlock is calculated, not stored (no `is_unlocked` column)
- **Per-circle**: Each circle unlocks independently

**Why Derived?**:
- Simpler data model (no need to update unlock status)
- Always accurate (recalculates on every check)
- Handles edge cases (member removal, etc.)

---

### 5.5 Reading Flow

**Files**:
- `app/read/page.tsx` (client component)

**Flow**:
```
User clicks "Read Reflections"
  ↓
[Client] read/page.tsx mounts:
  1. Authenticates user
  2. Gets current week
  3. Gets user's circle
  4. Fetches all circle members (excluding self)
  5. Fetches reflections for those members + week
  6. Fetches profiles separately (RLS constraint)
  7. Merges reflections + profiles into friend list
  ↓
Displays reflections one at a time:
  - Shows friend's name
  - Shows Rose/Bud/Thorn text
  - Shows audio player (if audio exists)
  - Shows transcript toggle (if transcript exists)
  - "Next" button or "Finish Reading"
  ↓
When finished:
  - Sets localStorage: reflection_read_${weekId} = 'true'
  - Shows bloom screen
  - "Return to Home" button
```

**Key Design Decisions**:
- **Sequential reading**: One friend at a time (intentional, for intimacy)
- **Separate profile fetch**: RLS requires separate query (can't join in one query)
- **Client-side read tracking**: localStorage tracks completion (not in DB)
- **Audio + transcript**: Users can listen or read cleaned transcript

---

### 5.6 SMS Notification Flow

#### Reminder SMS (Sunday/Monday)

**Files**:
- `supabase/functions/sunday-reminder/index.ts`
- `supabase/functions/monday-reminder/index.ts`
- `scripts/create-reminder-cron-jobs.sql` (cron setup)

**Flow**:
```
[Cron] Triggers at Sunday 7pm or Monday 7pm
  ↓
[Edge Function] sunday-reminder or monday-reminder:
  1. Gets current week
  2. Iterates through all circles
  3. For each circle:
     - Gets all members
     - Filters to pre-week members (excludes mid-week joiners)
     - Gets members who haven't submitted
     - Filters out users with sms_opted_out_at set
     - Sends reminder SMS
     - If Twilio returns opt-out error (21610), marks user as opted out
     - Logs to notification_logs
```

**Key Design**:
- **Per-circle iteration**: Each circle processed independently
- **Mid-week joiner exclusion**: Only sends to members who should have submitted
- **Opt-out checking**: All SMS functions check `sms_opted_out_at` before sending
- **Automatic opt-out handling**: Twilio opt-out errors (21610) automatically mark users as opted out
- **Deno environment**: Edge Functions run in Deno, use Twilio REST API directly

---

#### Unlock SMS (Real-time)

**Files**:
- `lib/supabase/unlock-sms.ts` → `sendUnlockSMS()`
- `app/api/send-unlock-sms/route.ts` → API wrapper
- `app/reflection/reflection-form.tsx` → Triggers after submission

**Flow**:
```
Reflection submitted
  ↓
[Client] Fire-and-forget: POST /api/send-unlock-sms
  ↓
[API Route] /api/send-unlock-sms:
  - Extracts baseUrl from headers
  - Calls sendUnlockSMS(circleId, weekId, baseUrl)
  ↓
[Utility] lib/supabase/unlock-sms.ts:
  1. Uses service role client (bypasses RLS)
  2. Checks isCircleUnlocked()
  3. If not unlocked → return early
  4. Gets all circle members
  5. Gets their phone numbers from profiles
  6. Checks notification_logs for duplicates
  7. Sends SMS to members who haven't received it
  8. Logs each send to notification_logs
  ↓
Returns: {success, sent, errors, details}
```

**Key Design Decisions**:
- **Duplicate prevention**: Checks `notification_logs` before sending
- **Phone normalization**: Automatically converts to E.164 format
- **Link in SMS**: Includes `/read` URL for immediate access
- **Fire-and-forget**: Doesn't block reflection submission

---

## 6. Component Architecture

### 6.1 Server vs Client Components

**Server Components** (default):
- Data fetching
- Access control (redirects)
- Initial page load

**Client Components** (`'use client'`):
- Forms with state
- Audio recording
- Interactive UI (buttons, toggles)
- localStorage access

---

### 6.2 Page Structure Pattern

**Typical Page Structure**:
```
app/[page]/page.tsx (Server Component)
  ├─ Authentication check
  ├─ Data fetching
  ├─ Access control (redirects)
  └─ Renders client component with data

app/[page]/[component].tsx (Client Component)
  ├─ Receives data as props
  ├─ Manages local state
  ├─ Handles user interactions
  └─ Makes API calls
```

**Example**: `app/reflection/page.tsx` (server) → `app/reflection/reflection-form.tsx` (client)

---

### 6.3 Key Components

#### `app/home/page.tsx`
**Type**: Server Component

**Purpose**: Main dashboard showing reflection status

**Data Fetched**:
- User profile
- Circle membership
- Current week
- User's reflection (if exists)
- Unlock status
- Mid-week join status
- All circle members and their profiles
- Submitted reflections for current week (for member status)

**States Rendered**:
1. Mid-week joiner → Special message
2. No reflection → "Start Reflection" button + MemberStatus component
3. Submitted, not unlocked → "Waiting" message + MemberStatus component
4. Unlocked → ReadingStatus component

**UI Elements**:
- "Review Reflections" button in top right (grey, with Rewind icon)
- Links to `/review` page for viewing past weeks

**Key Functions Called**:
- `getCurrentWeek()` → Week determination
- `isCircleUnlocked()` → Unlock check
- `didUserJoinMidWeek()` → Mid-week detection

**Member Status Logic**:
- Fetches all circle members with join timestamps
- Fetches all submitted reflections for current week
- Filters to pre-week members only (excludes mid-week joiners)
- Maps members to completion status (has submitted reflection or not)
- Sorts alphabetically by first name
- Passes to `MemberStatus` component for display

---

#### `app/reflection/page.tsx`
**Type**: Server Component

**Purpose**: Access control wrapper for reflection form

**Checks Performed** (all server-side for instant redirects):
1. Authentication → redirect to `/invite`
2. Current week exists → redirect to `/home`
3. User has circle → redirect to `/home`
4. Mid-week join → redirect to `/home`
5. Already submitted → redirect to `/home`

**If all pass**: Renders `ReflectionForm` with `weekId`, `circleId`, `userId`

**Why Server Component?**: Instant redirects (no flash), better UX

---

#### `app/reflection/reflection-form.tsx`
**Type**: Client Component

**Purpose**: Multi-step reflection wizard

**State Management**:
- `currentStep`: `'rose' | 'bud' | 'thorn' | 'review'`
- `draft`: Reflection data (text + audio URLs)
- `loading`: Submission state
- `error`: Error messages

**Draft Persistence**:
- Saved to `localStorage` as `reflection_draft_${weekId}`
- Loaded on mount
- Cleared on successful submission

**Submission Flow**:
1. Upload audio files (if any) → Supabase Storage
2. Insert reflection → database
3. Fire-and-forget unlock SMS check
4. Fire-and-forget transcription (if audio)
5. Clear localStorage
6. Redirect to `/home`

---

#### `app/read/page.tsx`
**Type**: Client Component

**Purpose**: Sequential reading of friends' reflections

**Data Loading** (on mount):
1. Authenticate user
2. Get current week
3. Get user's circle
4. Get all circle members (excluding self)
5. Get reflections for those members
6. Get profiles separately (RLS constraint)
7. Merge data into friend list

**State Management**:
- `friends`: Array of friend reflections
- `currentIndex`: Which friend is currently displayed
- `showTranscripts`: Toggle state for each section

**Reading Tracking**:
- `localStorage`: `reflection_read_${weekId}` = `'true'`
- Used by `ReadingStatus` component on home page

**Why Client Component?**: Needs localStorage, audio playback, interactive UI

---

#### `app/home/member-status.tsx`
**Type**: Client Component

**Purpose**: Display circle member completion status for current week

**Props**:
- `members`: Array of `{userId, firstName, hasCompleted}` objects

**Display Logic**:
- Shows all pre-week circle members (excludes mid-week joiners)
- Green checkmark (✓) and green background for completed members
- Grey X (✗) and grey background for incomplete members
- Sorted alphabetically by first name
- Responsive design with mobile-first breakpoints

**Key Design Decisions**:
- **Excludes mid-week joiners**: Consistent with unlock logic - they don't participate in current week
- **Visual indicators**: Clear color coding (green = done, grey = pending)
- **Alphabetical sorting**: Consistent display order regardless of submission order
- **Client component**: Simple presentational component, data fetched server-side

**Usage**: Displayed on home page in "no_reflection" and "waiting" states to show circle progress

---

#### `app/review/page.tsx`
**Type**: Server Component

**Purpose**: Week selection page for reviewing past reflections

**Data Fetched**:
- User's circle membership
- All past weeks (end_at < NOW())
- Unlock status for each week (via `isCircleUnlocked`)
- Groups weeks by month

**Display Logic**:
- Shows months in descending order (most recent first)
- Each month shows list of unlocked weeks
- Each week displays date range (e.g., "Jan 5 - Jan 12")
- Clicking a week navigates to `/review/[weekId]`
- Shows "No past reflections" message if no unlocked weeks exist

**Key Functions Called**:
- `getPastUnlockedWeeks()` → Fetches and groups past unlocked weeks

**Why Server Component?**: Data fetching happens server-side for better performance

---

#### `app/review/[weekId]/page.tsx`
**Type**: Server Component

**Purpose**: Week review page - fetches all data for a specific week

**Data Fetched**:
- Week details (validates week exists and is in the past)
- All circle members
- All reflections for that week and circle (including user's own)
- All profiles for reflection authors
- All comments for those reflections
- Commenter profiles
- Unlock status for that week

**Validation**:
- Checks week exists
- Checks week is in the past (redirects if not)
- Checks circle was unlocked for that week (redirects if not)

**Data Transformation**:
- Maps reflections with author names
- Groups comments by reflection_id
- Sorts reflections alphabetically by author name

**Why Server Component?**: Efficient server-side data fetching and validation

---

#### `app/review/[weekId]/review-display.tsx`
**Type**: Client Component

**Purpose**: Display all reflections for a week in a scrollable list

**Props**:
- `weekId`, `weekStart`, `weekEnd`: Week information
- `reflections`: Array of reflections with author names
- `commentsByReflection`: Map of reflection_id → comments
- `currentUserId`: To identify own reflection
- `wasUnlocked`: Whether circle was unlocked for that week

**Features**:
- Scrollable list showing all reflections at once
- Each reflection in a card with Rose/Bud/Thorn sections
- Own reflection marked with "(You)" label
- Audio playback and transcript toggles
- CommentSection component below each reflection
- "Copy Reflection to Clipboard" button only on own reflection
- Real-time comment refresh after adding new comments

**State Management**:
- `commentsMap`: Local state for comments (updated when new comment added)
- `showTranscripts`: Per-reflection transcript visibility state

**Why Client Component?**: Needs interactivity (audio playback, comment submission, transcript toggles)

---

#### `components/audio-recorder.tsx`
**Type**: Client Component

**Purpose**: Record, upload, and play audio for reflections

**Features**:
- MediaRecorder API for recording
- Supabase Storage upload
- Audio playback with progress bar
- Playback speed control (1x/1.5x)
- Retry/discard on upload failure

**State Management**:
- `state`: `'idle' | 'recording' | 'uploading' | 'uploaded' | 'error'`
- `audioBlob`: Recorded audio data
- `audioUrl`: Supabase Storage URL
- `recordingTime`: Timer during recording
- `currentTime`, `duration`: Playback progress

**Storage Path**: `{userId}/{weekId}/{section}.webm`

**Callbacks**:
- `onAudioUploaded(url)`: Called when upload succeeds
- `onDiscard()`: Called when user discards recording

---

## 7. API Routes & Server Functions

### 7.1 API Route Pattern

**Location**: `app/api/[route]/route.ts`

**Standard Structure**:
```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Validate input
    // 2. Authenticate (if needed)
    // 3. Business logic
    // 4. Return response
  } catch (error) {
    // Error handling
  }
}
```

---

### 7.2 Key API Routes

#### `/api/auth/callback`
**File**: `app/api/auth/callback/route.ts`

**Purpose**: Server-side profile and membership creation after OTP verification

**Input**: `{userId, firstName, phone, inviteToken}`

**Logic**:
1. Validates invite token → finds circle
2. Creates/updates `profiles` row
3. Checks if user already in circle
4. If not, inserts into `circle_members`
5. Returns success/error

**Why Separate Route?**: 
- Server-side ensures data consistency
- Handles edge cases (existing user, duplicate membership)
- Can use service role if needed (currently uses regular client)

---

#### `/api/send-unlock-sms`
**File**: `app/api/send-unlock-sms/route.ts`

**Purpose**: Wrapper for unlock SMS sending (extracts baseUrl from request)

**Input**: `{circleId, weekId}`

**Logic**:
1. Extracts baseUrl from request headers
2. Calls `sendUnlockSMS()` utility
3. Returns result

**Why Wrapper?**: Base URL detection needs request context (headers)

---

#### `/api/transcribe-audio`
**File**: `app/api/transcribe-audio/route.ts`

**Purpose**: Transcribe audio files after reflection submission

**Input**: `{reflectionId}`

**Logic**:
1. Authenticates user
2. Verifies reflection ownership
3. Fetches reflection with audio URLs
4. For each audio URL:
   - Calls `transcribeAndClean()` utility
   - Updates reflection with transcript
5. Returns success

**Why Fire-and-Forget?**: Transcription can take time, shouldn't block user

---

#### `/api/trigger-sunday-reminder` & `/api/trigger-monday-reminder`
**Files**: `app/api/trigger-*-reminder/route.ts`

**Purpose**: Manual triggers for reminder SMS (for testing)

**Logic**:
1. Validates environment variables
2. Calls Supabase Edge Function via HTTP
3. Returns result

**Why Manual Triggers?**: Allows testing without waiting for cron schedule

---

#### `/api/twilio-webhook`
**File**: `app/api/twilio-webhook/route.ts`

**Purpose**: Handle SMS replies from users (STOP/START commands)

**Input**: Twilio webhook form data (Body, From, To)

**Logic**:
1. Parses message body (STOP/START commands)
2. Normalizes phone number to E.164 format
3. Finds user profile by phone number
4. For STOP: Sets `sms_opted_out_at` timestamp
5. For START: Clears `sms_opted_out_at` (resubscribe)
6. Returns TwiML response confirming action

**Configuration**: Set webhook URL in Twilio Console → Phone Numbers → [Your Number] → Messaging

**Why Separate Endpoint?**: Twilio requires POST endpoint for handling SMS replies, returns TwiML XML responses

---

## 8. Utility Libraries

### 8.1 Supabase Utilities

#### `lib/supabase/server.ts`
**Function**: `createClient()`

**Purpose**: Create Supabase client for Server Components/API routes

**Key Features**:
- Cookie-based session management
- Automatic session refresh
- Handles Next.js App Router cookie API

**Usage**: Always use `await createClient()` in server contexts

---

#### `lib/supabase/client.ts`
**Function**: `createClient()`

**Purpose**: Create Supabase client for Client Components

**Key Features**:
- Browser-based session management
- Works with React hooks

**Usage**: `const supabase = createClient()` in client components

---

#### `lib/supabase/week-server.ts`
**Function**: `getCurrentWeek()`

**Purpose**: Server-side week determination

**Implementation**: Calls `getCurrentWeekClient()` with server client

**Usage**: `const week = await getCurrentWeek()`

---

#### `lib/supabase/week.ts`
**Function**: `getCurrentWeekClient(supabase: SupabaseClient)`

**Purpose**: Client-side week determination

**Implementation**: Calls Postgres RPC `get_or_create_current_week()`

**Usage**: `const week = await getCurrentWeekClient(supabase)`

---

#### `lib/supabase/unlock.ts`
**Function**: `isCircleUnlocked(circleId, weekId, supabaseClient?)`

**Purpose**: Determine if all pre-week members have submitted

**Logic**:
1. Gets week start time
2. Gets all circle members
3. Filters to pre-week members (excludes mid-week joiners)
4. Checks if all have submitted reflections
5. Returns boolean

**Key Design**: 
- Excludes mid-week joiners (they don't block unlock)
- Derived state (not stored in DB)
- Can use service role client to bypass RLS

---

#### `lib/supabase/unlock-sms.ts`
**Function**: `sendUnlockSMS(circleId, weekId, baseUrl?)`

**Purpose**: Send unlock SMS to all circle members

**Logic**:
1. Uses service role client (bypasses RLS)
2. Checks if circle is unlocked
3. Gets all members' phone numbers (including `sms_opted_out_at`)
4. Filters out users with `sms_opted_out_at` set
5. Checks `notification_logs` for duplicates
6. Sends SMS to members who haven't received it
7. If Twilio returns opt-out error (21610), marks user as opted out
8. Logs each send to `notification_logs`

**Key Features**:
- Duplicate prevention
- Opt-out checking before sending
- Automatic opt-out handling on Twilio errors
- Phone number normalization
- Includes `/read` link in SMS
- Returns detailed results

---

#### `lib/supabase/midweek-join.ts`
**Functions**:
- `didUserJoinMidWeek(userId, weekId, supabaseClient?)`
- `getNextWeekStart(currentWeekEnd)`

**Purpose**: Detect if user joined circle after week started

**Logic**:
1. Gets week start time
2. Gets user's circle membership `created_at`
3. Compares: `membership.created_at > week.start_at`
4. Returns boolean

**Usage**: Blocks reflection submission, excludes from unlock checks, excludes from reminders

---

#### `lib/supabase/review.ts`
**Functions**:
- `getPastUnlockedWeeks(circleId, supabaseClient)`
- `formatWeekRange(startAt, endAt)`

**Purpose**: Fetch and format past weeks for review feature

**Logic** (`getPastUnlockedWeeks`):
1. Fetches all past weeks (end_at < NOW())
2. For each week, checks if circle was unlocked using `isCircleUnlocked`
3. Filters to only unlocked weeks
4. Groups by month using `start_at` timestamp
5. Sorts months by most recent week first
6. Returns array of month groups

**Logic** (`formatWeekRange`):
- Formats week date range for display (e.g., "Jan 5 - Jan 12")
- Handles same-month and cross-month ranges

**Usage**: Used by review page to display selectable past weeks

---

### 8.2 Twilio Utilities

#### `lib/twilio/sms.ts`
**Functions**:
- `sendSMS(to: string, message: string): Promise<string>`
- `normalizePhoneNumber(phone: string): string`

**Purpose**: Send SMS via Twilio REST API

**Key Features**:
- Automatic phone number normalization (E.164 format)
- Detailed error messages
- Validates environment variables
- Preserves Twilio opt-out error code (21610) for upstream handling

**Usage**: Used by unlock SMS and reminder Edge Functions

**Error Handling**:
- Twilio error code 21610 (user opted out) is preserved and re-thrown
- Upstream functions catch this error and mark user as opted out in database

---

### 8.3 OpenAI Utilities

#### `lib/openai/transcribe.ts`
**Function**: `transcribeAndClean(audioUrl: string): Promise<string | null>`

**Purpose**: Transcribe audio and clean transcript

**Process**:
1. Fetches audio file from URL
2. Calls OpenAI Whisper API
3. Gets raw transcript
4. Cleans with GPT-4o-mini (removes filler words, adds punctuation)
5. Returns cleaned transcript

**Key Features**:
- Handles audio file fetching
- Aggressive filler word removal
- Fallback to raw transcript if cleaning fails

---

### 8.4 Other Utilities

#### `lib/utils/export-reflection.ts`
**Function**: `formatReflectionForExport(...)`

**Purpose**: Format reflection data for clipboard export

**Logic**: Combines text and transcripts, handles missing data gracefully

---

#### `lib/utils/invite-link.ts`
**Function**: `generateInviteLink(token: string, baseUrl?: string)`

**Purpose**: Generate full invite URL from token

---

#### `lib/supabase/review.ts`
**Functions**:
- `getPastUnlockedWeeks(circleId, supabaseClient): Promise<MonthGroup[]>`
- `formatWeekRange(startAt, endAt): string`

**Purpose**: Utility functions for review reflections feature

**getPastUnlockedWeeks**:
- Fetches all past weeks (end_at < NOW())
- Checks unlock status for each week using `isCircleUnlocked`
- Filters to only unlocked weeks
- Groups by month (e.g., "January 2025")
- Returns sorted array of month groups (most recent first)

**formatWeekRange**:
- Formats week date range for display
- Handles same-month (e.g., "Jan 5 - 12") and cross-month (e.g., "Jan 30 - Feb 6") ranges

**Usage**: Used by `/review` page to display selectable past weeks

---

## 9. Integration Points

### 9.1 Supabase Integration

#### Auth
- **Provider**: Supabase Auth
- **Method**: Phone OTP via Twilio Verify
- **Configuration**: Set in Supabase Dashboard (not in code)
- **Session Management**: Cookie-based via `@supabase/ssr`

#### Database
- **Provider**: Supabase PostgreSQL
- **Access**: Via Supabase JS client
- **Security**: RLS policies enforce access control
- **Functions**: Postgres RPC functions for complex logic

#### Storage
- **Bucket**: `reflection-audio` (private)
- **Path Pattern**: `{userId}/{weekId}/{section}.webm`
- **Policies**: Users can upload to own folder, all authenticated users can read

#### Edge Functions
- **Language**: Deno (TypeScript)
- **Purpose**: Cron jobs for reminder SMS
- **Deployment**: Via Supabase CLI
- **Secrets**: Set via Supabase Dashboard or CLI

---

### 9.2 Twilio Integration

#### OTP (via Supabase)
- **Service**: Twilio Verify
- **Configuration**: Supabase Dashboard → Auth → Phone Provider
- **Not directly called**: Handled by Supabase

#### SMS Sending
- **Service**: Twilio REST API
- **Usage**: Direct API calls in code
- **Files**: 
  - `lib/twilio/sms.ts` (utility)
  - `supabase/functions/*-reminder/index.ts` (Edge Functions)
  - `lib/supabase/unlock-sms.ts` (unlock SMS)

**Environment Variables**:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

**SMS Compliance (A2P 10DLC)**:
- **Consent Tracking**: `sms_consent_at` timestamp recorded when user provides phone during signup
- **Opt-Out Handling**: `sms_opted_out_at` timestamp set when user replies STOP or Twilio reports opt-out
- **Opt-Out Checking**: All SMS functions check `sms_opted_out_at` before sending
- **Webhook Endpoint**: `/api/twilio-webhook` handles STOP/START replies and updates opt-out status
- **Automatic Detection**: Twilio error code 21610 (opted out) automatically marks users in database
- **Resubscription**: Users can reply START to clear opt-out status

**Required for US SMS**: A2P 10DLC brand and campaign registration required for sending to US numbers

---

### 9.3 OpenAI Integration

#### Transcription
- **Service**: OpenAI Whisper API
- **Model**: `whisper-1`
- **Usage**: `lib/openai/transcribe.ts`

#### Transcript Cleaning
- **Service**: OpenAI Chat Completions
- **Model**: `gpt-4o-mini` (cost-efficient)
- **Purpose**: Remove filler words, add punctuation

**Environment Variable**: `OPENAI_API_KEY`

---

## 10. State Management Patterns

### 10.1 Server State

**Pattern**: Server Components fetch data, pass as props

**Example**: `app/home/page.tsx`
```typescript
// Server Component
const reflection = await supabase.from('reflections').select(...)
return <ClientComponent reflection={reflection} />
```

**Why**: 
- Better performance (no client-side fetching)
- SEO-friendly
- Simpler data flow

---

### 10.2 Client State

**Pattern**: React `useState` for component-local state

**Examples**:
- Form inputs
- UI toggles
- Loading states
- Error messages

---

### 10.3 Persistent State

**Pattern**: `localStorage` for draft data

**Keys Used**:
- `reflection_draft_${weekId}` → Reflection form draft
- `reflection_read_${weekId}` → Reading completion status

**Why localStorage?**:
- Survives page refreshes
- Client-side only (no server round-trip)
- Simple key-value storage

**Limitations**: 
- Not shared across devices
- Can be cleared by user
- Size limits (~5-10MB)

---

### 10.4 URL State

**Pattern**: Query parameters for navigation context

**Examples**:
- `/invite?token=abc123` → Invite token
- Future: `/home?circleId=xxx` → Selected circle (v2.0)

---

## 11. File Organization

### 11.1 Directory Structure

```
app/
  ├─ api/              # API routes (Next.js App Router)
  │  ├─ auth/
  │  ├─ send-unlock-sms/
  │  ├─ transcribe-audio/
  │  └─ trigger-*-reminder/
  ├─ home/             # Home page components
  ├─ invite/           # Invite flow components
  ├─ read/             # Reading flow
  ├─ reflection/       # Reflection wizard
  └─ layout.tsx        # Root layout

lib/
  ├─ supabase/         # Supabase utilities
  ├─ twilio/           # Twilio utilities
  ├─ openai/           # OpenAI utilities
  └─ utils/            # General utilities

components/             # Reusable components
  ├─ audio-recorder.tsx
  └─ flower-logo.tsx

supabase/
  ├─ functions/        # Edge Functions (Deno)
  └─ migrations/      # Database migrations (SQL)

scripts/               # Utility scripts
```

---

### 11.2 Naming Conventions

**Files**:
- `page.tsx` → Next.js route (App Router)
- `route.ts` → API route handler
- `*.tsx` → React component
- `*.ts` → TypeScript utility/type

**Functions**:
- `camelCase` for functions
- `PascalCase` for components
- Descriptive names (e.g., `isCircleUnlocked`, not `checkUnlock`)

**Database**:
- `snake_case` for columns
- `PascalCase` for policies
- Descriptive policy names (e.g., `"Users can view own profile"`)

---

## 12. Key Design Decisions

### 12.1 Why Server Components for Data Fetching?

**Decision**: Use Server Components for initial data load

**Rationale**:
- Better performance (no client-side waterfall)
- SEO-friendly (data in HTML)
- Simpler code (no loading states initially)
- Security (secrets never exposed to client)

**Trade-off**: Less interactivity, but we use Client Components where needed

---

### 12.2 Why RLS Instead of Application-Level Security?

**Decision**: Enforce security at database level via RLS

**Rationale**:
- **Defense in depth**: Even if app code has bugs, DB enforces rules
- **Simpler code**: Don't need to check permissions in every query
- **Consistent**: Same rules apply to all access methods (app, API, direct DB)

**Trade-off**: More complex policy setup, but more secure

---

### 12.3 Why Fire-and-Forget for Background Tasks?

**Decision**: SMS and transcription happen asynchronously

**Rationale**:
- **Better UX**: User doesn't wait for slow operations
- **Resilient**: Failures don't block user flow
- **Scalable**: Can retry/queue in background

**Trade-off**: Less immediate feedback, but acceptable for background tasks

---

### 12.4 Why Derived Unlock State?

**Decision**: Calculate unlock status, don't store it

**Rationale**:
- **Always accurate**: Recalculates on every check
- **Simpler data model**: No need to update unlock status
- **Handles edge cases**: Member removal, etc. automatically handled

**Trade-off**: Slightly more computation, but simpler and more reliable

---

### 12.5 Why Mid-Week Joiner Exclusion?

**Decision**: Users who join mid-week can't participate in current week

**Rationale**:
- **Fairness**: They didn't have full week to reflect
- **Prevents confusion**: Clear boundary for participation
- **Simpler unlock logic**: Don't need to handle partial participation

**Trade-off**: New users wait until next week, but clearer rules

---

### 12.6 Why Sequential Reading (One Friend at a Time)?

**Decision**: Show one reflection at a time, not all at once

**Rationale**:
- **Intimacy**: Forces focused attention on each friend
- **Mobile-friendly**: Easier to read on small screens
- **Intentional**: Matches app's core value of emotional intimacy

**Trade-off**: Slower to read all, but more meaningful experience

---

### 12.7 Why localStorage for Drafts?

**Decision**: Store reflection drafts in browser localStorage

**Rationale**:
- **Fast**: No server round-trip
- **Simple**: Key-value storage
- **Survives refreshes**: User doesn't lose work

**Trade-off**: Not synced across devices, but acceptable for weekly reflections

---

## 13. Data Flow Diagrams

### 13.1 Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    User Journey Flow                         │
└─────────────────────────────────────────────────────────────┘

1. INVITE FLOW
   User clicks invite link
   → /invite?token=abc123
   → Enter phone + name
   → OTP sent (Twilio Verify via Supabase)
   → OTP verified
   → /api/auth/callback creates profile + membership
   → Redirect to /home

2. HOME PAGE
   → Server fetches: profile, circle, week, reflection, unlock status
   → Shows appropriate state (no reflection / waiting / unlocked)
   → User clicks "Start Reflection"

3. REFLECTION FLOW
   → /reflection (server checks access)
   → ReflectionForm (client component)
   → User completes Rose → Bud → Thorn
   → Draft saved to localStorage
   → User submits
   → Audio uploaded to Storage (if any)
   → Reflection inserted to DB
   → Fire-and-forget: unlock SMS check
   → Fire-and-forget: transcription (if audio)
   → Redirect to /home

4. UNLOCK FLOW
   → Last member submits reflection
   → isCircleUnlocked() returns true
   → sendUnlockSMS() sends to all members
   → SMS includes /read link

5. READING FLOW
   → User clicks "Read Reflections"
   → /read page loads friends' reflections
   → User reads sequentially
   → Marks as read in localStorage
   → Returns to /home
```

---

### 13.2 Component Dependency Graph

```
app/home/page.tsx (Server)
  ├─ Uses: getCurrentWeek()
  ├─ Uses: isCircleUnlocked()
  ├─ Uses: didUserJoinMidWeek()
  └─ Renders: ReadingStatus (Client)
       └─ Links to: /read

app/reflection/page.tsx (Server)
  ├─ Uses: getCurrentWeek()
  ├─ Uses: didUserJoinMidWeek()
  └─ Renders: ReflectionForm (Client)
       ├─ Uses: AudioRecorder (Client)
       └─ Calls: /api/send-unlock-sms
            └─ Uses: sendUnlockSMS()
                 ├─ Uses: isCircleUnlocked()
                 └─ Uses: sendSMS()

app/read/page.tsx (Client)
  ├─ Uses: getCurrentWeekClient()
  └─ Fetches: reflections, profiles

lib/supabase/unlock.ts
  └─ Used by: home/page.tsx, unlock-sms.ts

lib/supabase/unlock-sms.ts
  ├─ Uses: isCircleUnlocked()
  ├─ Uses: sendSMS()
  └─ Used by: /api/send-unlock-sms, reflection-form.tsx
```

---

## 14. Common Patterns & Best Practices

### 14.1 Error Handling Pattern

**Server Components**:
```typescript
const { data, error } = await supabase.from('table').select()
if (error) {
  console.error('Error:', error)
  redirect('/error-page')
}
```

**Client Components**:
```typescript
try {
  const { error } = await supabase.from('table').insert(...)
  if (error) throw error
} catch (err) {
  setError(err.message)
  setLoading(false)
}
```

**API Routes**:
```typescript
try {
  // Logic
  return NextResponse.json({ success: true })
} catch (error) {
  console.error('Error:', error)
  return NextResponse.json(
    { error: error.message },
    { status: 500 }
  )
}
```

---

### 14.2 Authentication Check Pattern

**Server Components**:
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  redirect('/invite')
}
```

**Client Components**:
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  router.push('/invite')
  return
}
```

---

### 14.3 Data Fetching Pattern

**Server Component**:
```typescript
// Fetch data
const { data } = await supabase.from('table').select()
// Pass to client component
return <ClientComponent data={data} />
```

**Client Component**:
```typescript
useEffect(() => {
  const loadData = async () => {
    const { data } = await supabase.from('table').select()
    setData(data)
  }
  loadData()
}, [])
```

---

### 14.4 RLS-Aware Query Pattern

**Problem**: Can't join `profiles` with `reflections` due to RLS

**Solution**: Fetch separately, merge in app
```typescript
// 1. Fetch reflections
const { data: reflections } = await supabase
  .from('reflections')
  .select('user_id, rose_text, ...')

// 2. Extract user IDs
const userIds = reflections.map(r => r.user_id)

// 3. Fetch profiles separately
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, first_name')
  .in('id', userIds)

// 4. Merge in app
const profileMap = new Map(profiles.map(p => [p.id, p.first_name]))
```

---

## 15. Future Considerations

### 15.1 Multi-Circle Support (v2.0)

**Planned Changes**:
- `circle_members`: Change `UNIQUE(user_id)` → `UNIQUE(user_id, circle_id)`
- Add circle switcher on home page
- Add reflection share page (share to multiple circles)
- Update all queries to filter by selected circle

**Impact**: Most functions will need `circleId` parameter

---

### 15.2 Potential Improvements

- **Caching**: Add React Cache for frequently accessed data
- **Optimistic Updates**: Update UI before server confirms
- **Error Boundaries**: Better error handling for failed requests
- **Analytics**: Track user engagement, completion rates
- **Notifications**: Push notifications in addition to SMS

---

## 16. Troubleshooting Guide

### 16.1 Common Issues

**"User not authenticated" errors**:
- Check middleware is refreshing sessions
- Verify Supabase env vars are set
- Check cookie settings in `lib/supabase/server.ts`

**RLS blocking queries**:
- Verify user is authenticated
- Check RLS policies allow the operation
- Use service role client if needed (API routes only)

**Week not found**:
- Check `get_or_create_current_week()` function exists
- Verify RLS allows week creation
- Check timezone settings

**SMS not sending**:
- Verify Twilio env vars are set
- Check phone numbers are verified (trial accounts)
- Verify phone number normalization is working

**Audio upload fails**:
- Check Storage bucket exists: `reflection-audio`
- Verify Storage policies allow upload
- Check file size limits

---

## 17. Development Workflow

### 17.1 Local Development

1. **Setup**:
   ```bash
   npm install
   cp .env.local.example .env.local
   # Add Supabase, Twilio, OpenAI keys
   npm run dev
   ```

2. **Database Changes**:
   - Create migration in `supabase/migrations/`
   - Test locally (if using local Supabase)
   - Apply to dev Supabase project
   - Test on preview deployment

3. **Testing**:
   - Use test SMS page: `/test-sms`
   - Use manual trigger routes for reminders
   - Check Supabase logs for errors

---

### 17.2 Deployment Workflow

1. **Code Changes**:
   - Make changes on feature branch
   - Test locally
   - Commit and push

2. **Vercel**:
   - Auto-deploys on push
   - Preview deployments for branches
   - Production deployment for `main` branch

3. **Database**:
   - Apply migrations to production Supabase
   - Verify RLS policies
   - Test critical flows

---

## 18. Glossary

- **RLS**: Row Level Security (Supabase database-level access control)
- **RPC**: Remote Procedure Call (Postgres function callable via Supabase)
- **Edge Function**: Serverless function running in Deno (Supabase)
- **OTP**: One-Time Password (for phone authentication)
- **E.164**: International phone number format (+[country][number])
- **Fire-and-Forget**: Async operation that doesn't block user flow
- **Mid-Week Joiner**: User who joined circle after current week started
- **Pre-Week Member**: User who joined circle before/at week start

---

This architecture document should serve as your guide when building new features. Each function, component, and pattern has a specific purpose and relationship to the overall system. When in doubt, refer to existing patterns and maintain consistency with the established architecture.



