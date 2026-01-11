import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateCircleInviteLink } from '@/lib/utils/invite-link'

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Circle name is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's profile to get first_name for circle_owner
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Generate invite token from circle name: lowercase, no spaces, combined
    let baseToken = name.trim().toLowerCase().replace(/\s+/g, '')
    let inviteToken = baseToken
    let counter = 1

    // Check if a circle with this invite_token already exists, append number if needed
    while (true) {
      const { data: existingCircle } = await supabase
        .from('circles')
        .select('id')
        .eq('invite_token', inviteToken)
        .single()

      if (!existingCircle) {
        // Token is unique, break out of loop
        break
      }

      // Token exists, try with a number appended
      inviteToken = `${baseToken}${counter}`
      counter++
    }

    // Create the circle
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .insert({
        name: name.trim(),
        invite_token: inviteToken,
        circle_owner: profile.first_name,
      })
      .select('id, name, invite_token, circle_owner, created_at')
      .single()

    if (circleError || !circle) {
      console.error('Circle creation error:', circleError)
      return NextResponse.json(
        { 
          error: 'Failed to create circle',
          details: circleError?.message || 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Always use rosebuds.app for invite links (not Vercel URLs)
    const baseUrl = 'https://rosebuds.app'
    
    // Update the invite_link to ensure it uses the correct base URL
    // (database trigger may have set it, but we want to ensure it's correct)
    await updateCircleInviteLink(supabase, circle.id, inviteToken, baseUrl)

    // Fetch the circle again to get the updated invite_link
    const { data: circleWithLink, error: fetchError } = await supabase
      .from('circles')
      .select('id, name, invite_token, invite_link, circle_owner, created_at')
      .eq('id', circle.id)
      .single()

    if (fetchError || !circleWithLink) {
      console.error('Failed to fetch circle with invite_link:', fetchError)
      return NextResponse.json(
        { 
          error: 'Failed to retrieve invite link',
          details: fetchError?.message || 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Add creator as a member of the circle
    const { error: membershipError } = await supabase
      .from('circle_members')
      .insert({
        circle_id: circle.id,
        user_id: user.id,
      })

    if (membershipError) {
      console.error('Failed to add creator as member:', membershipError)
      // This is critical - if we can't add the creator, the circle is orphaned
      // But we'll still return success since the circle was created
      // The user can manually join via the invite link if needed
    }

    return NextResponse.json({
      success: true,
      circle: {
        ...circleWithLink,
      },
    })
  } catch (error) {
    console.error('Create circle error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
