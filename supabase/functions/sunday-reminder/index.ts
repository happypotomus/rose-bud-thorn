// Sunday 7pm Reminder Edge Function
// Gets all circles + members for current week, logs, and sends first reminder SMS

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  TWILIO_ACCOUNT_SID: string
  TWILIO_AUTH_TOKEN: string
  TWILIO_PHONE_NUMBER: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    // SUPABASE_URL is automatically available in Edge Functions
    // If not set as secret, construct from Deno.env.get('SUPABASE_PROJECT_REF')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 
      (Deno.env.get('SUPABASE_PROJECT_REF') 
        ? `https://${Deno.env.get('SUPABASE_PROJECT_REF')}.supabase.co`
        : null)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')!
    
    // Get app base URL for links in SMS
    const appBaseUrl = Deno.env.get('APP_URL') || 
      Deno.env.get('NEXT_PUBLIC_APP_URL') ||
      'https://rose-bud-thorn.vercel.app'

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set as Edge Function secrets.')
    }
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Missing Twilio environment variables. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must be set as Edge Function secrets.')
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get or create current week
    const { data: currentWeek, error: weekError } = await supabase
      .rpc('get_or_create_current_week')
      .single()

    if (weekError) {
      throw new Error(`Failed to get current week: ${weekError.message}`)
    }

    if (!currentWeek) {
      throw new Error('No current week found or created')
    }

    // Get all circles
    const { data: circles, error: circlesError } = await supabase
      .from('circles')
      .select('id, name')

    if (circlesError) {
      throw new Error(`Failed to fetch circles: ${circlesError.message}`)
    }

    if (!circles || circles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No circles found',
          weekId: currentWeek.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Collect all unique users across all circles who should receive reminders
    const weekStart = new Date(currentWeek.start_at)
    const uniqueUserIds = new Set<string>()
    const userToFirstCircle = new Map<string, { id: string; name: string }>()

    for (const circle of circles) {
      // Get all members of this circle with their join time
      const { data: members, error: membersError } = await supabase
        .from('circle_members')
        .select('user_id, created_at')
        .eq('circle_id', circle.id)

      if (membersError) {
        console.error(`Error fetching members for circle ${circle.id}:`, membersError)
        continue
      }

      if (!members || members.length === 0) {
        continue
      }

      // Filter to only members who joined before or at the week start
      // Mid-week joiners should not receive reminders for the current week
      const preWeekMembers = members.filter(
        m => new Date(m.created_at) <= weekStart
      )

      // Add unique user IDs and track first circle for each user
      for (const member of preWeekMembers) {
        if (!uniqueUserIds.has(member.user_id)) {
          uniqueUserIds.add(member.user_id)
          userToFirstCircle.set(member.user_id, { id: circle.id, name: circle.name })
        }
      }
    }

    if (uniqueUserIds.size === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          weekId: currentWeek.id,
          totalSent: 0,
          totalErrors: 0,
          message: 'No users found who should receive reminders',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Get profiles for all unique users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, phone, sms_opted_out_at')
      .in('id', Array.from(uniqueUserIds))

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`)
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          weekId: currentWeek.id,
          totalSent: 0,
          totalErrors: 0,
          message: 'No profiles found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Send SMS once per user (skip opted-out users)
    const results = []
    let totalSent = 0
    let totalErrors = 0

    for (const profile of profiles) {
      // Skip users who have opted out
      if (profile.sms_opted_out_at) {
        console.log(`Skipping SMS to ${profile.phone} - user opted out at ${profile.sms_opted_out_at}`)
        continue
      }

      try {
        // Personalize message with link to reflection page
        const firstName = profile.first_name || 'there'
        const reflectionUrl = `${appBaseUrl}/reflection`
        const message = `Hey ${firstName}, it's time for your weekly Rose–Bud–Thorn reflection. ${reflectionUrl}`

        // Send SMS via Twilio REST API
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
        const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`)

        const smsResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: twilioPhoneNumber,
            To: profile.phone,
            Body: message,
          }),
        })

        if (!smsResponse.ok) {
          const errorText = await smsResponse.text()
          const errorData = JSON.parse(errorText)
          
          // Check if user opted out (Twilio error code 21610)
          if (smsResponse.status === 400 && errorData.code === 21610) {
            // User has opted out - mark in database
            await supabase
              .from('profiles')
              .update({ sms_opted_out_at: new Date().toISOString() })
              .eq('id', profile.id)
            
            console.log(`User ${profile.id} (${profile.phone}) has opted out - marked in database`)
            continue // Skip this user
          }
          
          throw new Error(`Twilio API error: ${smsResponse.status} ${errorText}`)
        }

        const smsData = await smsResponse.json()
        const messageSid = smsData.sid

        // Get first circle for this user (for logging purposes)
        const firstCircle = userToFirstCircle.get(profile.id) || { id: '', name: 'Unknown' }

        // Log notification once per user
        const { error: logError } = await supabase
          .from('notification_logs')
          .insert({
            user_id: profile.id,
            circle_id: firstCircle.id,
            week_id: currentWeek.id,
            type: 'first_reminder',
            message: message,
          })

        if (logError) {
          console.error(`Error logging notification for user ${profile.id}:`, logError)
          // Continue anyway - SMS was sent
        }

        results.push({
          userId: profile.id,
          firstName: profile.first_name,
          phone: profile.phone,
          circleId: firstCircle.id,
          circleName: firstCircle.name,
          messageSid,
          logged: !logError,
        })

        totalSent++
      } catch (error) {
        console.error(`Error sending SMS to ${profile.phone}:`, error)
        totalErrors++
        const firstCircle = userToFirstCircle.get(profile.id) || { id: '', name: 'Unknown' }
        results.push({
          userId: profile.id,
          firstName: profile.first_name,
          phone: profile.phone,
          circleId: firstCircle.id,
          circleName: firstCircle.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        weekId: currentWeek.id,
        totalSent,
        totalErrors,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Sunday reminder function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

