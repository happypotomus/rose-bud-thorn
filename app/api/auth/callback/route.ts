import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { userId, firstName, phone, inviteToken } = await request.json()

    if (!userId || !firstName || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // If inviteToken is provided, verify it and get the circle
    // If not provided, this is a new user onboarding (no circle to join yet)
    let circle: { id: string } | null = null
    
    if (inviteToken) {
      const { data: circleData, error: circleError } = await supabase
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

      if (circleError || !circleData) {
        return NextResponse.json(
          { 
            error: 'Invalid invite token',
            details: circleError?.message || 'Circle not found',
          },
          { status: 400 }
        )
      }

      circle = circleData
    }

    // Check if user already has a profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, sms_consent_at')
      .eq('id', userId)
      .single()

    // Create or update profile
    // Set SMS consent timestamp when user signs up (implicit consent by providing phone)
    const now = new Date().toISOString()
    
    if (existingProfile) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          phone: phone,
          // Only set consent if not already set (preserve existing consent)
          sms_consent_at: existingProfile.sms_consent_at || now,
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Profile update error:', {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
        })
        return NextResponse.json(
          { 
            error: 'Failed to update profile',
            details: updateError.message,
          },
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
          sms_consent_at: now, // Set consent timestamp for new users
        })

      if (insertError) {
        console.error('Profile insert error:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        })
        return NextResponse.json(
          { 
            error: 'Failed to create profile',
            details: insertError.message,
          },
          { status: 500 }
        )
      }
    }

    // If inviteToken was provided, add user to that circle
    if (circle) {
      // Check if user is already in THIS specific circle
      const { data: existingMembership } = await supabase
        .from('circle_members')
        .select('circle_id')
        .eq('user_id', userId)
        .eq('circle_id', circle.id)
        .maybeSingle()

      if (existingMembership) {
        // User already in this specific circle - return success
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
        console.error('Circle membership insert error:', {
          message: membershipError.message,
          code: membershipError.code,
          details: membershipError.details,
          hint: membershipError.hint,
        })
        // If unique constraint violation, user is already in this specific circle
        if (membershipError.code === '23505') {
          return NextResponse.json({
            success: true,
            alreadyInCircle: true,
            circleId: circle.id,
          })
        }

        return NextResponse.json(
          { 
            error: 'Failed to add user to circle',
            details: membershipError.message,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        alreadyInCircle: false,
        circleId: circle.id,
      })
    }

    // No inviteToken = new user onboarding (just profile creation, no circle membership yet)
    return NextResponse.json({
      success: true,
      alreadyInCircle: false,
      circleId: null,
    })
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

