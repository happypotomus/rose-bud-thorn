import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { userId, firstName, phone, inviteToken } = await request.json()

    if (!userId || !firstName || !phone || !inviteToken) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get circle from invite token
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('id')
      .eq('invite_token', inviteToken)
      .single()

    // Enhanced error logging
    if (circleError) {
      console.error('Circle lookup error in API:', {
        message: circleError.message,
        code: circleError.code,
        details: circleError.details,
        hint: circleError.hint,
      })
      console.error('Invite token used:', inviteToken)
    }

    if (circleError || !circle) {
      return NextResponse.json(
        { 
          error: 'Invalid invite token',
          details: circleError?.message || 'Circle not found',
        },
        { status: 400 }
      )
    }

    // Check if user already has a profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    // Create or update profile
    if (existingProfile) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          phone: phone,
        })
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        )
      }
    } else {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          first_name: firstName,
          phone: phone,
        })

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        )
      }
    }

    // Check if user is already in a circle
    const { data: existingMembership } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', userId)
      .single()

    if (existingMembership) {
      // User already in a circle - redirect to their existing circle
      // Return the existing circle_id so frontend can redirect
      return NextResponse.json({
        success: true,
        alreadyInCircle: true,
        circleId: existingMembership.circle_id,
      })
    }

    // Add user to circle
    const { error: membershipError } = await supabase
      .from('circle_members')
      .insert({
        circle_id: circle.id,
        user_id: userId,
      })

    if (membershipError) {
      // If unique constraint violation, user is already in a circle
      if (membershipError.code === '23505') {
        const { data: existing } = await supabase
          .from('circle_members')
          .select('circle_id')
          .eq('user_id', userId)
          .single()

        return NextResponse.json({
          success: true,
          alreadyInCircle: true,
          circleId: existing?.circle_id,
        })
      }

      return NextResponse.json(
        { error: 'Failed to add user to circle' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      alreadyInCircle: false,
      circleId: circle.id,
    })
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

