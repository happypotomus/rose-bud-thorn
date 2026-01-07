import type { SupabaseClient } from '@supabase/supabase-js'
import { isCircleUnlocked } from './unlock'

export type WeekWithDates = {
  id: string
  start_at: string
  end_at: string
  created_at: string
}

export type MonthGroup = {
  month: string // e.g., "January 2025"
  weeks: WeekWithDates[]
}

/**
 * Get all past and current weeks where the circle was unlocked
 * Groups weeks by month for display
 * 
 * @param circleId - The circle ID
 * @param supabaseClient - Supabase client
 * @param userId - Optional user ID to filter weeks where user has a submission
 * @returns Array of month groups with weeks
 */
export async function getPastUnlockedWeeks(
  circleId: string,
  supabaseClient: SupabaseClient,
  userId?: string
): Promise<MonthGroup[]> {
  const supabase = supabaseClient

  // Get all weeks that have started (past and current, but not future)
  // This includes weeks where start_at <= NOW()
  const { data: pastWeeks, error: weeksError } = await supabase
    .from('weeks')
    .select('id, start_at, end_at, created_at')
    .lte('start_at', new Date().toISOString())
    .order('start_at', { ascending: false })

  if (weeksError || !pastWeeks) {
    console.error('Error fetching past weeks:', weeksError)
    return []
  }

  // Check which weeks were unlocked for this circle
  const unlockedWeeks: WeekWithDates[] = []
  for (const week of pastWeeks) {
    const unlocked = await isCircleUnlocked(circleId, week.id, supabase)
    if (unlocked) {
      unlockedWeeks.push(week)
    }
  }

  // If userId provided, filter to only weeks with user submissions
  if (userId) {
    const { data: userReflections } = await supabase
      .from('reflections')
      .select('week_id')
      .eq('user_id', userId)
      .eq('circle_id', circleId)
      .not('submitted_at', 'is', null)

    const weeksWithSubmissions = new Set(
      userReflections?.map(r => r.week_id) || []
    )

    // Filter unlocked weeks to only include those where user has a submission
    const filteredWeeks = unlockedWeeks.filter(week =>
      weeksWithSubmissions.has(week.id)
    )

    // Replace unlockedWeeks with filtered list
    unlockedWeeks.length = 0
    unlockedWeeks.push(...filteredWeeks)
  }

  // Group by month
  const monthMap = new Map<string, WeekWithDates[]>()
  
  for (const week of unlockedWeeks) {
    const startDate = new Date(week.start_at)
    const monthKey = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, [])
    }
    monthMap.get(monthKey)!.push(week)
  }

  // Convert to array and sort months (most recent first)
  const monthGroups: MonthGroup[] = Array.from(monthMap.entries())
    .map(([month, weeks]) => ({
      month,
      weeks: weeks.sort((a, b) => 
        new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
      ),
    }))
    .sort((a, b) => {
      // Sort by the most recent week in each month
      const aLatest = new Date(a.weeks[0].start_at).getTime()
      const bLatest = new Date(b.weeks[0].start_at).getTime()
      return bLatest - aLatest
    })

  return monthGroups
}

/**
 * Format week date range for display
 * @param startAt - Week start timestamp
 * @param endAt - Week end timestamp
 * @returns Formatted string like "Jan 5 - Jan 12"
 */
export function formatWeekRange(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const startDay = start.getDate()
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const endDay = end.getDate()
  
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`
  } else {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`
  }
}
