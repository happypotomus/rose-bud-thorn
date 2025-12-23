// Twilio webhook endpoint for handling SMS replies (STOP, START, etc.)
// Configure this URL in Twilio Console → Phone Numbers → [Your Number] → Messaging → Webhook URL

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const messageBody = formData.get('Body')?.toString().toUpperCase().trim()
    const fromPhone = formData.get('From')?.toString()
    const toPhone = formData.get('To')?.toString()

    if (!fromPhone) {
      return new NextResponse('Missing From phone number', { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for webhook')
      return new NextResponse('Server configuration error', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Normalize phone number for lookup (ensure E.164 format)
    const normalizedFrom = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`

    // Handle STOP command
    if (messageBody === 'STOP' || messageBody === 'STOPALL' || messageBody === 'UNSUBSCRIBE') {
      // Find user by phone number
      const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id, phone, sms_opted_out_at')
        .eq('phone', normalizedFrom)
        .single()

      if (findError || !profile) {
        console.error('Could not find profile for opt-out:', normalizedFrom, findError)
        // Still return success to Twilio (they'll block anyway)
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from reminders.</Message></Response>',
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }

      // Mark user as opted out if not already
      if (!profile.sms_opted_out_at) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ sms_opted_out_at: new Date().toISOString() })
          .eq('id', profile.id)

        if (updateError) {
          console.error('Error updating opt-out status:', updateError)
        } else {
          console.log(`User ${profile.id} (${normalizedFrom}) opted out via STOP command`)
        }
      }

      // Return TwiML response confirming opt-out
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from reminders. Reply START to resubscribe.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Handle START command (resubscribe)
    if (messageBody === 'START' || messageBody === 'YES' || messageBody === 'UNSTOP') {
      const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id, phone, sms_opted_out_at')
        .eq('phone', normalizedFrom)
        .single()

      if (findError || !profile) {
        console.error('Could not find profile for resubscribe:', normalizedFrom, findError)
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>We could not find your account. Please contact support.</Message></Response>',
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }

      // Clear opt-out status
      if (profile.sms_opted_out_at) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ sms_opted_out_at: null })
          .eq('id', profile.id)

        if (updateError) {
          console.error('Error clearing opt-out status:', updateError)
        } else {
          console.log(`User ${profile.id} (${normalizedFrom}) resubscribed via START command`)
        }
      }

      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been resubscribed to reminders. You will receive weekly reflection reminders.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Unknown command - return helpful message
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Reply STOP to unsubscribe from reminders, or START to resubscribe.</Message></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  } catch (error) {
    console.error('Twilio webhook error:', error)
    // Return empty response to avoid Twilio retries
    return new NextResponse('', { status: 200 })
  }
}
