import { createClient } from './server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Check if a user joined a circle mid-week (after the week started)
 * 
 * @param userId - The user ID to check
 * @param weekId - The week ID to check
 * @param supabaseClient - Optional Supabase client (if not provided, creates one with server client)
 * @returns true if user joined after the week started, false otherwise
 */
export async function didUserJoinMidWeek(
  userId: string,
  weekId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const supabase = supabaseClient || await createClient()

  // Get the week's start_at
  const { data: week, error: weekError } = await supabase
    .from('weeks')
    .select('start_at')
    .eq('id', weekId)
    .single()

  if (weekError || !week) {
    console.error('[Mid-week join check] Error fetching week:', {
      userId,
      weekId,
      error: weekError,
      week: week
    })
    // Return false on error - safer to allow reflection than block it
    return false
  }

  // Get when the user joined the circle
  const { data: membership, error: membershipError } = await supabase
    .from('circle_members')
    .select('created_at')
    .eq('user_id', userId)
    .single()

  if (membershipError || !membership) {
    console.error('[Mid-week join check] Error fetching circle membership:', {
      userId,
      weekId,
      error: membershipError,
      membership: membership
    })
    // Return false on error - safer to allow reflection than block it
    return false
  }

  // Check if user joined after the week started
  // Convert to Date objects and ensure we're comparing timestamps correctly
  const weekStart = new Date(week.start_at)
  const joinTime = new Date(membership.created_at)

  // Compare using getTime() for reliable numeric comparison
  const isMidWeek = joinTime.getTime() > weekStart.getTime()

  // Debug logging to help diagnose issues
  console.log('[Mid-week join check]', {
    userId,
    weekId,
    weekStartRaw: week.start_at,
    joinTimeRaw: membership.created_at,
    weekStartISO: weekStart.toISOString(),
    joinTimeISO: joinTime.toISOString(),
    weekStartTimestamp: weekStart.getTime(),
    joinTimeTimestamp: joinTime.getTime(),
    isMidWeek,
    timeDiffMs: joinTime.getTime() - weekStart.getTime(),
    timeDiffHours: (joinTime.getTime() - weekStart.getTime()) / (1000 * 60 * 60)
  })

  return isMidWeek
}

/**
 * Get the next week start date (next Sunday at 7pm)
 * 
 * @param currentWeekEnd - The end date of the current week
 * @returns Date object for the next Sunday at 7pm
 */
export function getNextWeekStart(currentWeekEnd: Date): Date {
  // The next week starts 1 minute after the current week ends (at 7pm)
  // currentWeekEnd is next Sunday at 6:59pm, so next week starts at 7pm same day
  const nextWeekStart = new Date(currentWeekEnd)
  nextWeekStart.setMinutes(nextWeekStart.getMinutes() + 1)
  return nextWeekStart
}





