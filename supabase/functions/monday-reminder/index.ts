// Monday 7pm Reminder Edge Function
// Finds non-submitters for current week, logs, and sends second reminder SMS

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get current week
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

    const results = []
    let totalSent = 0
    let totalErrors = 0

    // For each circle, find members who haven't submitted
    for (const circle of circles) {
      // Get all members of this circle with their join time
      const { data: members, error: membersError } = await supabase
        .from('circle_members')
        .select('user_id, created_at')
        .eq('circle_id', circle.id)

      if (membersError) {
        console.error(`Error fetching members for circle ${circle.id}:`, membersError)
        totalErrors++
        continue
      }

      if (!members || members.length === 0) {
        continue
      }

      // Filter to only members who joined before or at the week start
      // Mid-week joiners should not receive reminders for the current week
      const weekStart = new Date(currentWeek.start_at)
      const preWeekMembers = members.filter(
        m => new Date(m.created_at) <= weekStart
      )

      if (preWeekMembers.length === 0) {
        continue // No members were present at week start
      }

      const userIds = preWeekMembers.map(m => m.user_id)

      // Get reflections for this week and circle
      const { data: reflections, error: reflectionsError } = await supabase
        .from('reflections')
        .select('user_id')
        .eq('circle_id', circle.id)
        .eq('week_id', currentWeek.id)
        .not('submitted_at', 'is', null)

      if (reflectionsError) {
        console.error(`Error fetching reflections for circle ${circle.id}:`, reflectionsError)
        totalErrors++
        continue
      }

      // Find users who haven't submitted (users in circle but not in reflections)
      const submittedUserIds = new Set((reflections || []).map(r => r.user_id))
      const nonSubmitters = userIds.filter(userId => !submittedUserIds.has(userId))

      if (nonSubmitters.length === 0) {
        continue // Everyone in this circle has submitted
      }

      // Get profiles for non-submitters
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, phone')
        .in('id', nonSubmitters)

      if (profilesError) {
        console.error(`Error fetching profiles for circle ${circle.id}:`, profilesError)
        totalErrors++
        continue
      }

      if (!profiles || profiles.length === 0) {
        continue
      }

      // Send reminder SMS to each non-submitter
      for (const profile of profiles) {
        try {
          const reflectionUrl = `${appBaseUrl}/reflection`
          const message = `Gentle reminder to complete your weekly reflection. ${reflectionUrl}`

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
            throw new Error(`Twilio API error: ${smsResponse.status} ${errorText}`)
          }

          const smsData = await smsResponse.json()
          const messageSid = smsData.sid

          // Log notification
          const { error: logError } = await supabase
            .from('notification_logs')
            .insert({
              user_id: profile.id,
              circle_id: circle.id,
              week_id: currentWeek.id,
              type: 'second_reminder',
              message: message,
            })

          if (logError) {
            console.error(`Error logging notification for user ${profile.id}:`, logError)
            // Continue anyway - SMS was sent
          }

          results.push({
            circleId: circle.id,
            circleName: circle.name,
            userId: profile.id,
            firstName: profile.first_name,
            phone: profile.phone,
            messageSid,
            logged: !logError,
          })

          totalSent++
        } catch (error) {
          console.error(`Error sending SMS to ${profile.phone}:`, error)
          totalErrors++
          results.push({
            circleId: circle.id,
            circleName: circle.name,
            userId: profile.id,
            firstName: profile.first_name,
            phone: profile.phone,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
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
    console.error('Monday reminder function error:', error)
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

