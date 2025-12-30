import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendUnlockSMS } from '@/lib/supabase/unlock-sms'

export async function POST(request: NextRequest) {
  try {
    const { reflectionId, circleIds } = await request.json()

    if (!reflectionId || !circleIds || !Array.isArray(circleIds) || circleIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: reflectionId and circleIds array' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch the original reflection
    const { data: originalReflection, error: fetchError } = await supabase
      .from('reflections')
      .select('rose_text, bud_text, thorn_text, rose_audio_url, bud_audio_url, thorn_audio_url, week_id, user_id')
      .eq('id', reflectionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !originalReflection) {
      return NextResponse.json(
        { error: 'Reflection not found or access denied' },
        { status: 404 }
      )
    }

    // Verify user is a member of all selected circles
    const { data: memberships, error: membershipsError } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', user.id)
      .in('circle_id', circleIds)

    if (membershipsError) {
      return NextResponse.json(
        { error: 'Failed to verify circle memberships' },
        { status: 500 }
      )
    }

    const userCircleIds = new Set(memberships?.map(m => m.circle_id) || [])
    const invalidCircles = circleIds.filter(id => !userCircleIds.has(id))

    if (invalidCircles.length > 0) {
      return NextResponse.json(
        { error: 'You are not a member of one or more selected circles' },
        { status: 403 }
      )
    }

    // Get base URL for unlock SMS links
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (host ? `${protocol}://${host}` : 
       (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rosebuds.app'))

    // For each selected circle, create a reflection if it doesn't already exist
    const results = []
    const errors = []

    for (const circleId of circleIds) {
      // Check if reflection already exists for this circle+week+user
      const { data: existing } = await supabase
        .from('reflections')
        .select('id')
        .eq('circle_id', circleId)
        .eq('week_id', originalReflection.week_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        // Already exists - skip (idempotent)
        results.push({ circleId, status: 'exists', reflectionId: existing.id })
        continue
      }

      // Create new reflection for this circle
      const { data: newReflection, error: insertError } = await supabase
        .from('reflections')
        .insert({
          circle_id: circleId,
          week_id: originalReflection.week_id,
          user_id: user.id,
          rose_text: originalReflection.rose_text,
          bud_text: originalReflection.bud_text,
          thorn_text: originalReflection.thorn_text,
          rose_audio_url: originalReflection.rose_audio_url,
          bud_audio_url: originalReflection.bud_audio_url,
          thorn_audio_url: originalReflection.thorn_audio_url,
          submitted_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertError || !newReflection) {
        errors.push({ circleId, error: insertError?.message || 'Failed to create reflection' })
      } else {
        results.push({ circleId, status: 'created', reflectionId: newReflection.id })
        
        // Check if circle is unlocked and send unlock SMS (fire-and-forget)
        // Do this for each circle independently
        sendUnlockSMS(circleId, originalReflection.week_id, baseUrl).catch((err) => {
          // Log error but don't block the user flow
          console.error(`Error sending unlock SMS for circle ${circleId}:`, err)
        })
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Some reflections failed to share',
          results,
          errors,
        },
        { status: 207 } // Multi-Status
      )
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Reflection shared to ${results.length} circle${results.length !== 1 ? 's' : ''}`,
    })
  } catch (error) {
    console.error('Reflection share error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}





