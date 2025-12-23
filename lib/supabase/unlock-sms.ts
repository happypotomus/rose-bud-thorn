import { createClient } from '@supabase/supabase-js'
import { isCircleUnlocked } from './unlock'
import { sendSMS } from '../twilio/sms'

/**
 * Send unlock SMS to all members of a circle when everyone has submitted
 * This should be called after a reflection is submitted to check if the circle is now unlocked
 * 
 * @param circleId - The circle ID
 * @param weekId - The week ID
 * @param baseUrl - The base URL of the app (for the link in SMS)
 * @returns Object with success status and details
 */
export async function sendUnlockSMS(
  circleId: string,
  weekId: string,
  baseUrl?: string
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
    .select('id, phone, sms_opted_out_at')
    .in('id', userIds)

  if (profilesError || !profiles || profiles.length === 0) {
    console.error('Error fetching profiles for unlock SMS:', profilesError)
    return { success: false, sent: 0, errors: 0, details: profilesError }
  }

  // Check which users have already received unlock SMS for this week
  const { data: existingLogs } = await supabase
    .from('notification_logs')
    .select('user_id')
    .eq('circle_id', circleId)
    .eq('week_id', weekId)
    .eq('type', 'unlock')

  const usersWhoReceivedSMS = new Set(
    existingLogs?.map(log => log.user_id) || []
  )

  // Filter out users who have already received the SMS or opted out
  const profilesToNotify = profiles.filter(
    profile => !usersWhoReceivedSMS.has(profile.id) && !profile.sms_opted_out_at
  )

  if (profilesToNotify.length === 0) {
    // All users have already received the SMS
    return { success: true, sent: 0, errors: 0, details: 'All users already notified' }
  }

  // Get app base URL for the link
  // Use provided baseUrl, or fall back to environment variables
  const appBaseUrl = baseUrl || 
    process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-app.vercel.app')
  const readUrl = `${appBaseUrl}/read`

  // Send unlock SMS to members who haven't received it yet
  const message = `Everyone in your circle has submitted! You can now read each other's reflections. ${readUrl}`
  let sent = 0
  let errors = 0
  const results: any[] = []

  for (const profile of profilesToNotify) {
    // Skip if user opted out (double-check, though we already filtered)
    if (profile.sms_opted_out_at) {
      console.log(`Skipping unlock SMS to ${profile.phone} - user opted out`)
      continue
    }

    try {
      // Send SMS (phone number will be normalized inside sendSMS)
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
    } catch (error: any) {
      // Check if user opted out (Twilio error code 21610)
      if (error.code === 21610 || error.message?.includes('opted out') || error.message?.includes('unsubscribed')) {
        // User has opted out - mark in database
        await supabase
          .from('profiles')
          .update({ sms_opted_out_at: new Date().toISOString() })
          .eq('id', profile.id)
        
        console.log(`User ${profile.id} (${profile.phone}) has opted out - marked in database`)
        continue // Skip this user
      }

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

