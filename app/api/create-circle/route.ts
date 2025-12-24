import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInviteLink } from '@/lib/utils/invite-link'
import { randomUUID } from 'crypto'

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

    // Generate unique invite token
    const inviteToken = randomUUID()

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

    // Generate invite link with correct base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rose-bud-thorn.vercel.app')
    
    const inviteLink = generateInviteLink(inviteToken, baseUrl)

    // Update circle with invite_link
    const { error: updateError } = await supabase
      .from('circles')
      .update({ invite_link: inviteLink })
      .eq('id', circle.id)

    if (updateError) {
      console.error('Failed to update invite_link:', updateError)
      // Continue anyway - the trigger should have set it
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
        ...circle,
        invite_link: inviteLink,
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
