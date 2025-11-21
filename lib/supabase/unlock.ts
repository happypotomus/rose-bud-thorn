import { createClient } from './server'

/**
 * Check if a circle is unlocked for a given week
 * A circle is unlocked when all active members have submitted their reflections
 * 
 * @param circleId - The circle ID to check
 * @param weekId - The week ID to check
 * @returns true if all members have submitted, false otherwise
 */
export async function isCircleUnlocked(
  circleId: string,
  weekId: string
): Promise<boolean> {
  const supabase = await createClient()

  // Get all active circle members
  const { data: members, error: membersError } = await supabase
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', circleId)

  if (membersError || !members || members.length === 0) {
    console.error('Error fetching circle members:', membersError)
    return false
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
  const memberIds = new Set(members.map(m => m.user_id))
  const submittedUserIds = new Set(reflections?.map(r => r.user_id) || [])

  // Check if every member has submitted
  for (const memberId of memberIds) {
    if (!submittedUserIds.has(memberId)) {
      // At least one member hasn't submitted
      return false
    }
  }

  // All members have submitted
  return true
}

