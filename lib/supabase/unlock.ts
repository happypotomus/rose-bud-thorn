import { createClient } from './server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Check if a circle is unlocked for a given week
 * A circle is unlocked when all active members (who joined before the week started) have submitted their reflections
 * Members who joined mid-week are excluded from the unlock check
 * 
 * @param circleId - The circle ID to check
 * @param weekId - The week ID to check
 * @param supabaseClient - Optional Supabase client (if not provided, creates one with server client)
 * @returns true if all pre-week members have submitted, false otherwise
 */
export async function isCircleUnlocked(
  circleId: string,
  weekId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const supabase = supabaseClient || await createClient()

  // Get the week's start_at to determine which members were present at week start
  const { data: week, error: weekError } = await supabase
    .from('weeks')
    .select('start_at')
    .eq('id', weekId)
    .single()

  if (weekError || !week) {
    console.error('Error fetching week:', weekError)
    return false
  }

  const weekStart = new Date(week.start_at)

  // Get all circle members with their join time
  const { data: members, error: membersError } = await supabase
    .from('circle_members')
    .select('user_id, created_at')
    .eq('circle_id', circleId)

  if (membersError || !members || members.length === 0) {
    console.error('Error fetching circle members:', membersError)
    return false
  }

  // Filter to only members who joined before or at the week start
  // These are the members who should have submitted reflections
  const preWeekMemberIds = members
    .filter(m => new Date(m.created_at) <= weekStart)
    .map(m => m.user_id)

  if (preWeekMemberIds.length === 0) {
    // No members were present at week start, so circle is considered unlocked
    return true
  }

  // Get all submitted reflections for this circle and week
  const { data: reflections, error: reflectionsError } = await supabase
    .from('reflections')
    .select('user_id')
    .eq('circle_id', circleId)
    .eq('week_id', weekId)
    .not('submitted_at', 'is', null)

  if (reflectionsError) {
    console.error('Error fetching reflections:', reflectionsError)
    return false
  }

  // Create sets of user IDs for efficient lookup
  const preWeekMemberIdSet = new Set(preWeekMemberIds)
  const submittedUserIds = new Set(reflections?.map(r => r.user_id) || [])

  // Check if every pre-week member has submitted
  for (const memberId of preWeekMemberIds) {
    if (!submittedUserIds.has(memberId)) {
      // At least one pre-week member hasn't submitted
      return false
    }
  }

  // All pre-week members have submitted
  return true
}

