import { createClient } from './server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Week = {
  id: string
  start_at: string
  end_at: string
  created_at: string
}

/**
 * Get or create the current week (client-side version)
 * Accepts a Supabase client instance for use in client components
 */
export async function getCurrentWeekClient(supabase: SupabaseClient): Promise<Week | null> {
  const { data, error } = await supabase
    .rpc('get_or_create_current_week')
    .single()

  if (error) {
    console.error('Error getting current week:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return null
  }

  return data as Week
}

/**
 * Get or create the current week (server-side version)
 * Returns the week where now() is between start_at and end_at
 * If no such week exists, creates one
 */
export async function getCurrentWeek(): Promise<Week | null> {
  const supabase = await createClient()
  return getCurrentWeekClient(supabase)
}

