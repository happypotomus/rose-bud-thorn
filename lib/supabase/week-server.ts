import { createClient } from './server'
import { getCurrentWeekClient, type Week } from './week'

/**
 * Get or create the current week (server-side version)
 * Returns the week where now() is between start_at and end_at
 * If no such week exists, creates one
 */
export async function getCurrentWeek(): Promise<Week | null> {
  const supabase = await createClient()
  return getCurrentWeekClient(supabase)
}

