import { createClient } from '@supabase/supabase-js'
import { isCircleUnlocked } from './unlock'
import { sendSMS } from '../twilio/sms'

/**
 * Send unlock SMS to all members of a circle when everyone has submitted
 * This should be called after a reflection is submitted to check if the circle is now unlocked
 * 
 * @param circleId - The circle ID
 * @param weekId - The week ID
 * @returns Object with success status and details
 */
export async function sendUnlockSMS(
  circleId: string,
  weekId: string
): Promise<{ success: boolean; sent: number; errors: number; details?: any }> {
  // Use service role client to bypass RLS (needed for API routes)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check if circle is unlocked (pass the same client to avoid RLS issues)
  const unlocked = await isCircleUnlocked(circleId, weekId, supabase)
  
  if (!unlocked) {
    // Circle is not unlocked yet, nothing to do
    return { success: true, sent: 0, errors: 0 }
  }

  // Get all circle members
  const { data: members, error: membersError } = await supabase
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', circleId)

  if (membersError || !members || members.length === 0) {
    console.error('Error fetching circle members for unlock SMS:', membersError)
    return { success: false, sent: 0, errors: 0, details: membersError }
  }

  // Get profiles for all members (to get phone numbers)
  const userIds = members.map(m => m.user_id)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, phone')
    .in('id', userIds)

  if (profilesError || !profiles || profiles.length === 0) {
    console.error('Error fetching profiles for unlock SMS:', profilesError)
    return { success: false, sent: 0, errors: 0, details: profilesError }
  }

  // Send unlock SMS to all members
  const message = "Everyone in your circle has submitted! You can now read each other's reflections."
  let sent = 0
  let errors = 0
  const results: any[] = []

  for (const profile of profiles) {
    try {
      // Send SMS
      const messageSid = await sendSMS(profile.phone, message)

      // Log to notification_logs
      const { error: logError } = await supabase
        .from('notification_logs')
        .insert({
          user_id: profile.id,
          circle_id: circleId,
          week_id: weekId,
          type: 'unlock',
          message: message,
        })

      if (logError) {
        console.error(`Error logging unlock notification for user ${profile.id}:`, logError)
        // Continue anyway - SMS was sent
      }

      results.push({
        userId: profile.id,
        phone: profile.phone,
        messageSid,
        logged: !logError,
      })

      sent++
    } catch (error) {
      console.error(`Error sending unlock SMS to ${profile.phone}:`, error)
      errors++
      results.push({
        userId: profile.id,
        phone: profile.phone,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    success: true,
    sent,
    errors,
    details: results,
  }
}

